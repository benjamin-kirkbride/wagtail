from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class PuckAppConfig(AppConfig):
    name = "wagtail.contrib.puck"
    label = "wagtailpuck"
    verbose_name = _("Wagtail Puck editor")
    default_auto_field = "django.db.models.AutoField"
