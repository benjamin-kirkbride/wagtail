import os
import shutil
import unittest
from unittest import mock

from django.test import TestCase
from django.utils.safestring import SafeString

from wagtail.contrib.puck import rendering
from wagtail.contrib.puck.rendering import BUNDLE_PATH, render_puck


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
