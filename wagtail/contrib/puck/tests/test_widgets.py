import json
from unittest import mock

from django import forms
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase, override_settings

from wagtail.admin.staticfiles import versioned_static
from wagtail.contrib.puck.widgets import PuckWidget


class TestPuckWidget(SimpleTestCase):
    def test_render_includes_hidden_input_and_init_attrs(self):
        widget = PuckWidget()
        html = widget.render(
            "puck_body",
            json.dumps({"content": [], "root": {"props": {}}}),
            attrs={"id": "id_puck_body"},
        )
        self.assertIn('type="hidden"', html)
        self.assertIn('name="puck_body"', html)
        self.assertIn('data-controller="w-init"', html)
        self.assertIn('data-w-init-event-value="w-puck:init"', html)
        self.assertIn("data-puck-input", html)
        self.assertIn("data-w-init-detail-value", html)

    def test_render_includes_mount_div(self):
        widget = PuckWidget()
        html = widget.render(
            "puck_body",
            "",
            attrs={"id": "id_puck_body"},
        )
        self.assertIn("data-puck-editor-root", html)
        self.assertIn('data-puck-input-id="id_puck_body"', html)

    def test_is_not_hidden(self):
        # is_hidden False so the field participates in the visible form layout
        self.assertFalse(PuckWidget().is_hidden)

    def _detail(self, widget=None):
        widget = widget or PuckWidget()
        context = widget.get_context("puck_body", "", {"id": "id_puck_body"})
        return json.loads(context["widget"]["attrs"]["data-w-init-detail-value"])

    def test_detail_value_is_valid_json(self):
        # Force the "no site CSS configured" case (ignore any ambient env var).
        with mock.patch.dict("os.environ", {"WAGTAILPUCK_PREVIEW_CSS": ""}):
            detail = self._detail()
        self.assertIsInstance(detail, dict)
        self.assertIn("previewCss", detail)

    def test_preview_css_always_includes_render_stylesheet(self):
        # The minimal rich-text content stylesheet is injected into the canvas
        # regardless of the setting, so the canvas and published page match.
        with mock.patch.dict("os.environ", {"WAGTAILPUCK_PREVIEW_CSS": ""}):
            detail = self._detail()
        self.assertEqual(
            detail["previewCss"],
            [versioned_static("wagtailpuck/css/puck-render.css")],
        )

    @override_settings(
        WAGTAILPUCK_PREVIEW_CSS=["/static/css/site.css", "/static/css/print.css"]
    )
    def test_preview_css_carries_configured_site_stylesheets(self):
        detail = self._detail()
        self.assertEqual(
            detail["previewCss"],
            [
                versioned_static("wagtailpuck/css/puck-render.css"),
                "/static/css/site.css",
                "/static/css/print.css",
            ],
        )

    def test_preview_css_env_fallback(self):
        # With no setting, a comma-separated env var is consulted, so a consuming
        # site's editor can be pointed at its stylesheet without editing settings.
        with mock.patch.dict(
            "os.environ",
            {"WAGTAILPUCK_PREVIEW_CSS": "/static/css/site.css, /static/css/x.css"},
        ):
            detail = self._detail()
        self.assertEqual(
            detail["previewCss"],
            [
                versioned_static("wagtailpuck/css/puck-render.css"),
                "/static/css/site.css",
                "/static/css/x.css",
            ],
        )

    @override_settings(WAGTAILPUCK_PREVIEW_CSS=[])
    def test_preview_css_explicit_empty_setting_ignores_env(self):
        with mock.patch.dict(
            "os.environ", {"WAGTAILPUCK_PREVIEW_CSS": "/static/css/site.css"}
        ):
            detail = self._detail()
        self.assertEqual(
            detail["previewCss"],
            [versioned_static("wagtailpuck/css/puck-render.css")],
        )

    def test_detail_includes_render_class(self):
        with mock.patch.dict("os.environ", {"WAGTAILPUCK_RENDER_CLASS": ""}):
            detail = self._detail()
        self.assertIn("renderClass", detail)
        self.assertEqual(detail["renderClass"], "")

    def test_detail_includes_pages_api_url(self):
        # The internal-page link picker fetches from the admin pages API; its
        # reversed URL rides along in the widget options.
        detail = self._detail()
        self.assertIn("pagesApiUrl", detail)
        self.assertTrue(detail["pagesApiUrl"].endswith("/pages/"))

    @override_settings(WAGTAILPUCK_RENDER_CLASS="stream")
    def test_render_class_from_setting(self):
        detail = self._detail()
        self.assertEqual(detail["renderClass"], "stream")

    def test_render_class_env_fallback(self):
        # With no setting, the env var is consulted, so a consuming site's editor
        # canvas can be given its content-column class without editing settings.
        with mock.patch.dict("os.environ", {"WAGTAILPUCK_RENDER_CLASS": "stream"}):
            detail = self._detail()
        self.assertEqual(detail["renderClass"], "stream")

    def test_custom_attrs_are_merged(self):
        widget = PuckWidget(attrs={"class": "custom", "data-puck-input": "yes"})
        # explicitly passed attrs override defaults
        self.assertEqual(widget.attrs["data-puck-input"], "yes")
        self.assertEqual(widget.attrs["class"], "custom")
        # defaults still present
        self.assertEqual(widget.attrs["data-controller"], "w-init")

    def test_media_contains_puck_assets(self):
        media = PuckWidget().media
        self.assertIn(versioned_static("wagtailpuck/js/puck.js"), media._js)
        css = media._css["all"]
        self.assertIn(versioned_static("wagtailpuck/css/puck.css"), css)


class TestPuckWidgetFormFieldRoundTrip(SimpleTestCase):
    """The JSON string<->dict marshalling is handled by forms.JSONField."""

    def _field(self):
        return forms.JSONField(widget=PuckWidget())

    def test_valid_json_string_cleans_to_dict(self):
        field = self._field()
        doc = {"content": [{"type": "Heading"}], "root": {"props": {}}}
        cleaned = field.clean(json.dumps(doc))
        self.assertEqual(cleaned, doc)

    def test_malformed_json_raises_validation_error(self):
        field = self._field()
        with self.assertRaises(ValidationError):
            field.clean("{not valid json")
