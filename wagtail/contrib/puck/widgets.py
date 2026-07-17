import json
import os

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.forms import Media, widgets
from django.utils.functional import cached_property

from wagtail.admin.staticfiles import versioned_static
from wagtail.contrib.puck.rendering import get_render_class


def get_preview_css():
    """Stylesheet URLs to render the editor canvas under the site's CSS.

    The editor renders page content in an isolated iframe. By default Puck's
    ``AutoFrame`` clones the *admin's* stylesheets into that iframe, so content
    shows admin fonts/colours/resets rather than the site's. We disable that
    cloning (``iframe.syncHostStyles: false``) and instead inject these
    stylesheets into the iframe, so the canvas matches the published page.

    Always includes ``puck-render.css`` (the minimal rich-text content styles
    also linked on the published page). Additional sheets come from the
    ``WAGTAILPUCK_PREVIEW_CSS`` setting — a list of already-resolved URLs or
    static paths pointing at the site's own stylesheet(s), e.g.::

        WAGTAILPUCK_PREVIEW_CSS = ["/static/css/site.css"]

    If the setting is absent, a comma-separated ``WAGTAILPUCK_PREVIEW_CSS``
    environment variable is consulted as a fallback (handy for pointing a
    consuming site's editor at its stylesheet without editing its settings).
    With neither set, only ``puck-render.css`` is injected, so content renders
    under neutral UA defaults instead of admin styles.
    """
    configured = getattr(settings, "WAGTAILPUCK_PREVIEW_CSS", None)
    if configured is None:
        env = os.environ.get("WAGTAILPUCK_PREVIEW_CSS", "")
        configured = [url.strip() for url in env.split(",") if url.strip()]
    return [
        versioned_static("wagtailpuck/css/puck-render.css"),
        *configured,
    ]


class PuckWidget(widgets.HiddenInput):
    """A hidden input that the Puck editor React bundle mounts onto.

    Mirrors ``DraftailRichTextArea``: the value round-trips as a JSON string
    through the hidden input, and the marshalling between that string and a
    dict is handled entirely by Django's ``forms.JSONField`` (the form field
    for the ``PuckField`` model field). This widget therefore behaves like a
    plain ``HiddenInput`` for value handling and does not parse JSON itself.
    """

    template_name = "wagtailpuck/widgets/puck_editor.html"
    is_hidden = False

    def __init__(self, *args, **kwargs):
        # Server-side editor options, dispatched to the client via the w-init
        # controller's detail. ``previewCss`` lists the stylesheets the client
        # injects into the preview iframe so the canvas matches the site;
        # ``renderClass`` is the site's content-column class, applied to the
        # canvas drop zone (via Puck metadata) so the content measure matches
        # the published page. See ``get_render_class``.
        self.options = {
            "previewCss": get_preview_css(),
            "renderClass": get_render_class(),
        }

        default_attrs = {
            "data-puck-input": True,
            "data-controller": "w-init",
            "data-w-init-event-value": "w-puck:init",
        }
        attrs = kwargs.get("attrs")
        if attrs:
            default_attrs.update(attrs)
        kwargs["attrs"] = default_attrs

        super().__init__(*args, **kwargs)

    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)
        context["widget"]["attrs"]["data-w-init-detail-value"] = json.dumps(
            self.options,
            cls=DjangoJSONEncoder,
        )
        return context

    @cached_property
    def media(self):
        return Media(
            js=[
                versioned_static("wagtailpuck/js/puck.js"),
            ],
            css={"all": [versioned_static("wagtailpuck/css/puck.css")]},
        )
