import os
import shutil
import unittest
from unittest import mock

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils.safestring import SafeString

from wagtail.contrib.puck import rendering
from wagtail.contrib.puck.rendering import BUNDLE_PATH, get_render_class, render_puck


class TestGetRenderClass(TestCase):
    @override_settings(WAGTAILPUCK_RENDER_CLASS="stream")
    def test_from_setting(self):
        self.assertEqual(get_render_class(), "stream")

    def test_env_fallback_and_strip(self):
        with mock.patch.dict("os.environ", {"WAGTAILPUCK_RENDER_CLASS": " stream "}):
            self.assertEqual(get_render_class(), "stream")

    def test_default_empty(self):
        with mock.patch.dict("os.environ", {"WAGTAILPUCK_RENDER_CLASS": ""}):
            self.assertEqual(get_render_class(), "")


class TestRenderPuckRenderClass(TestCase):
    def setUp(self):
        cache.clear()
        rendering._warned_unavailable = False

    @override_settings(WAGTAILPUCK_RENDER_CLASS="stream")
    @mock.patch(
        "wagtail.contrib.puck.rendering.shutil.which", return_value="/usr/bin/node"
    )
    @mock.patch("wagtail.contrib.puck.rendering.os.path.exists", return_value=True)
    @mock.patch("wagtail.contrib.puck.rendering.subprocess.run")
    def test_render_class_passed_to_subprocess_env(
        self, mock_run, mock_exists, mock_which
    ):
        mock_run.return_value = mock.Mock(
            returncode=0, stdout="<div>ok</div>", stderr=""
        )
        render_puck({"content": [], "root": {"props": {}}})
        _, kwargs = mock_run.call_args
        self.assertEqual(kwargs["env"]["WAGTAILPUCK_RENDER_CLASS"], "stream")

    @mock.patch(
        "wagtail.contrib.puck.rendering.shutil.which", return_value="/usr/bin/node"
    )
    @mock.patch("wagtail.contrib.puck.rendering.os.path.exists", return_value=True)
    @mock.patch("wagtail.contrib.puck.rendering.subprocess.run")
    def test_render_class_is_part_of_cache_key(
        self, mock_run, mock_exists, mock_which
    ):
        doc = {"content": [], "root": {"props": {}}}
        with override_settings(WAGTAILPUCK_RENDER_CLASS="stream"):
            mock_run.return_value = mock.Mock(
                returncode=0, stdout="<div>stream</div>", stderr=""
            )
            self.assertEqual(render_puck(doc), "<div>stream</div>")
        # Same document, different class -> must re-render, not serve the cached
        # "stream" HTML.
        with override_settings(WAGTAILPUCK_RENDER_CLASS="other"):
            mock_run.return_value = mock.Mock(
                returncode=0, stdout="<div>other</div>", stderr=""
            )
            self.assertEqual(render_puck(doc), "<div>other</div>")
        self.assertEqual(mock_run.call_count, 2)


class TestResolvePageLinks(TestCase):
    """The `page:<id>` -> URL resolution walk (block-shape-agnostic)."""

    def test_resolves_tokens_across_button_hero_and_richtext(self):
        doc = {
            "content": [
                {"type": "Button", "props": {"href": "page:5", "label": "x"}},
                {
                    "type": "Hero",
                    "props": {
                        "buttons": [
                            {"href": "page:7"},
                            {"href": "https://ext.example/"},
                        ]
                    },
                },
                {
                    "type": "RichText",
                    "props": {
                        "richtext": '<p><a href="page:9">a</a> and '
                        '<a href="/rel/">b</a></p>'
                    },
                },
            ],
            "root": {"props": {}},
        }
        with mock.patch.object(
            rendering,
            "_resolve_page_url",
            side_effect=lambda pid, cm: f"/url/{pid}/",
        ):
            out = rendering._resolve_page_links(doc)

        self.assertEqual(out["content"][0]["props"]["href"], "/url/5/")
        self.assertEqual(out["content"][1]["props"]["buttons"][0]["href"], "/url/7/")
        # External URLs pass through untouched.
        self.assertEqual(
            out["content"][1]["props"]["buttons"][1]["href"], "https://ext.example/"
        )
        # Rich-text href token rewritten; a relative href left as-is.
        self.assertIn('href="/url/9/"', out["content"][2]["props"]["richtext"])
        self.assertIn('href="/rel/"', out["content"][2]["props"]["richtext"])
        # Original document is not mutated (a copy is returned).
        self.assertEqual(doc["content"][0]["props"]["href"], "page:5")

    def test_leaves_prose_mentioning_page_colon_alone(self):
        # A bare "page:5" in body text is neither a whole-string token nor an
        # href attribute, so it must not be resolved.
        with mock.patch.object(
            rendering,
            "_resolve_page_url",
            side_effect=AssertionError("must not resolve prose"),
        ):
            out = rendering._resolve_page_links(
                {"content": [{"props": {"body": "see page:5 for details"}}]}
            )
        self.assertEqual(out["content"][0]["props"]["body"], "see page:5 for details")

    def test_missing_page_resolves_to_hash(self):
        self.assertEqual(rendering._resolve_page_url(999999, {}), "#")

    def test_existing_page_resolves_to_its_url(self):
        from wagtail.models import Page

        page = Page.objects.filter(depth__gte=2).first()
        self.assertIsNotNone(page, "test tree has at least one non-root page")
        self.assertEqual(
            rendering._resolve_page_url(page.id, {}), page.get_url() or "#"
        )


class TestRenderPuckResolvesLinks(TestCase):
    def setUp(self):
        cache.clear()
        rendering._warned_unavailable = False

    @mock.patch(
        "wagtail.contrib.puck.rendering.shutil.which", return_value="/usr/bin/node"
    )
    @mock.patch("wagtail.contrib.puck.rendering.os.path.exists", return_value=True)
    @mock.patch("wagtail.contrib.puck.rendering.subprocess.run")
    def test_tokens_resolved_before_ssr(self, mock_run, mock_exists, mock_which):
        mock_run.return_value = mock.Mock(returncode=0, stdout="<div/>", stderr="")
        doc = {
            "content": [{"type": "Button", "props": {"href": "page:5"}}],
            "root": {"props": {}},
        }
        with mock.patch.object(
            rendering, "_resolve_page_url", side_effect=lambda pid, cm: f"/url/{pid}/"
        ):
            render_puck(doc)
        _, kwargs = mock_run.call_args
        payload = kwargs["input"]
        # The SSR bundle receives the RESOLVED url, never the token.
        self.assertIn("/url/5/", payload)
        self.assertNotIn("page:5", payload)


class TestRenderPuckGracefulDegradation(TestCase):
    def setUp(self):
        # Reset the once-only warning guard between tests.
        rendering._warned_unavailable = False

    @mock.patch("wagtail.contrib.puck.rendering.shutil.which", return_value=None)
    def test_returns_empty_when_node_missing(self, mock_which):
        result = render_puck({"content": [], "root": {"props": {}}})
        self.assertEqual(result, "")
        self.assertIsInstance(result, SafeString)

    @mock.patch(
        "wagtail.contrib.puck.rendering.shutil.which", return_value="/usr/bin/node"
    )
    @mock.patch("wagtail.contrib.puck.rendering.os.path.exists", return_value=False)
    def test_returns_empty_when_bundle_missing(self, mock_exists, mock_which):
        result = render_puck({"content": [], "root": {"props": {}}})
        self.assertEqual(result, "")
        self.assertIsInstance(result, SafeString)

    @mock.patch("wagtail.contrib.puck.rendering.shutil.which", return_value=None)
    def test_none_normalizes_without_error(self, mock_which):
        # None input must not raise; degrades to empty string.
        self.assertEqual(render_puck(None), "")

    @mock.patch("wagtail.contrib.puck.rendering.shutil.which", return_value=None)
    def test_json_string_input_accepted(self, mock_which):
        self.assertEqual(render_puck('{"content": [], "root": {"props": {}}}'), "")

    @unittest.skipUnless(
        shutil.which("node") and os.path.exists(BUNDLE_PATH),
        "Node SSR bundle not built (JS side builds it later)",
    )
    def test_ssr_renders_html_when_bundle_present(self):
        # Only runs once the JS agent has built puck-ssr.js.
        result = render_puck({"content": [], "root": {"props": {}}})
        self.assertIsInstance(result, SafeString)
