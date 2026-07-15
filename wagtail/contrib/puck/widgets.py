import json

from django.core.serializers.json import DjangoJSONEncoder
from django.forms import Media, widgets
from django.utils.functional import cached_property

from wagtail.admin.staticfiles import versioned_static


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
        # Server-side editor options; empty for v1 but kept extensible.
        self.options = {}

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
