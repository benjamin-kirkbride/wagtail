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
