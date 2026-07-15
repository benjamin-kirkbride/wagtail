import json

from django.test import TestCase
from django.urls import reverse

from wagtail.admin.staticfiles import versioned_static
from wagtail.models import Page
from wagtail.test.testapp.models import PuckTestPage
from wagtail.test.utils import WagtailTestUtils

DOC_A = {
    "content": [{"type": "Heading", "props": {"title": "Alpha"}}],
    "root": {"props": {}},
}
DOC_B = {
    "content": [{"type": "Text", "props": {"text": "Bravo"}}],
    "root": {"props": {}},
}


def _revision_puck_body(revision):
    """Revision content may store the JSONField value as a dict or a JSON string."""
    value = revision.content["puck_body"]
    if isinstance(value, str):
        return json.loads(value)
    return value


class TestPuckAddView(WagtailTestUtils, TestCase):
    def setUp(self):
        self.root_page = Page.objects.get(id=2)
        self.login()

    def test_add_view_renders_widget(self):
        response = self.client.get(
            reverse(
                "wagtailadmin_pages:add",
                args=("tests", "pucktestpage", self.root_page.id),
            )
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-controller="w-init"')
        self.assertContains(response, 'data-w-init-event-value="w-puck:init"')
        self.assertContains(response, "data-puck-editor-root")
        # media JS is loaded
        self.assertContains(response, versioned_static("wagtailpuck/js/puck.js"))


class TestPuckSaveAndPublish(WagtailTestUtils, TestCase):
    def setUp(self):
        self.root_page = Page.objects.get(id=2)
        self.login()

    def _post(self, action, doc, slug):
        post_data = {
            "title": "Puck page",
            "slug": slug,
            "puck_body": json.dumps(doc),
            action: "x",
        }
        return self.client.post(
            reverse(
                "wagtailadmin_pages:add",
                args=("tests", "pucktestpage", self.root_page.id),
            ),
            post_data,
        )

    def test_save_draft_creates_revision_with_puck_data(self):
        response = self._post("action-save-draft", DOC_A, "puck-draft")
        self.assertEqual(response.status_code, 302)

        page = PuckTestPage.objects.get(slug="puck-draft")
        self.assertFalse(page.live)
        self.assertEqual(page.revisions.count(), 1)
        self.assertEqual(_revision_puck_body(page.get_latest_revision()), DOC_A)

    def test_publish_sets_live_and_snapshots_puck_data(self):
        response = self._post("action-publish", DOC_B, "puck-published")
        self.assertEqual(response.status_code, 302)

        page = PuckTestPage.objects.get(slug="puck-published")
        self.assertTrue(page.live)
        self.assertEqual(_revision_puck_body(page.get_latest_revision()), DOC_B)

    def test_malformed_json_is_rejected(self):
        post_data = {
            "title": "Broken",
            "slug": "puck-broken",
            "puck_body": "{not valid json",
            "action-save-draft": "x",
        }
        response = self.client.post(
            reverse(
                "wagtailadmin_pages:add",
                args=("tests", "pucktestpage", self.root_page.id),
            ),
            post_data,
        )
        # Form redisplays (200) rather than redirecting on success; no page made.
        self.assertEqual(response.status_code, 200)
        self.assertFalse(PuckTestPage.objects.filter(slug="puck-broken").exists())


class TestPuckRevert(WagtailTestUtils, TestCase):
    def setUp(self):
        self.root_page = Page.objects.get(id=2)

        self.page = PuckTestPage(
            title="Reverting page",
            slug="reverting-page",
            puck_body=DOC_A,
        )
        self.root_page.add_child(instance=self.page)
        self.revision_a = self.page.save_revision()

        self.page.puck_body = DOC_B
        self.revision_b = self.page.save_revision()

        self.login()

    def test_revert_view_reinits_editor_from_prior_revision(self):
        response = self.client.get(
            reverse(
                "wagtailadmin_pages:revisions_revert",
                args=(self.page.id, self.revision_a.id),
            )
        )
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        # The hidden input must carry revision A's Puck JSON so the editor
        # re-initialises from the reverted document.
        self.assertIn("Alpha", html)
        self.assertNotIn("Bravo", html)
