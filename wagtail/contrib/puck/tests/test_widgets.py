import json

from django import forms
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

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

    def test_detail_value_is_valid_json(self):
        widget = PuckWidget()
        context = widget.get_context("puck_body", "", {"id": "id_puck_body"})
        detail = context["widget"]["attrs"]["data-w-init-detail-value"]
        self.assertEqual(json.loads(detail), {})

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
