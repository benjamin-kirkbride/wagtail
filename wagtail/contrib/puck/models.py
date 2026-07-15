from django.db import models

from wagtail.contrib.puck.fields import PuckField, default_puck_document
from wagtail.contrib.puck.rendering import render_puck


class PuckPageMixin(models.Model):
    """Opt-in mixin adding a Puck visual-editor body to a page type.

    Consumers add ``FieldPanel("puck_body")`` to ``content_panels`` and use a
    page template that includes ``wagtailpuck/puck/render.html`` to display the
    server-rendered output, e.g.::

        {% include "wagtailpuck/puck/render.html" %}

    ``get_context`` exposes the rendered HTML as ``rendered_puck``.
    """

    puck_body = PuckField(default=default_puck_document, blank=True)

    class Meta:
        abstract = True

    def get_context(self, request, *args, **kwargs):
        context = super().get_context(request, *args, **kwargs)
        context["rendered_puck"] = render_puck(self.puck_body)
        return context
