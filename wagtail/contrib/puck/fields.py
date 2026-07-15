from django.db import models


def default_puck_document():
    """The default empty Puck document.

    Kept module-level so migrations can serialize a reference to it.
    """
    return {"content": [], "root": {"props": {}}}


class PuckField(models.JSONField):
    """A JSONField that stores a Puck editor document and renders with PuckWidget."""

    def formfield(self, **kwargs):
        from wagtail.contrib.puck.widgets import PuckWidget

        kwargs.setdefault("widget", PuckWidget)
        return super().formfield(**kwargs)
