import os
import subprocess

from setuptools import setup
from setuptools.command.build_py import build_py as base_build_py
from setuptools.command.sdist import sdist as base_sdist

# The admin CSS/JS are compiled from client/ by npm and are gitignored, so a
# source checkout never carries them. Their presence marks an npm build as done.
COMPILED_ASSETS = os.path.join(
    "wagtail", "admin", "static", "wagtailadmin", "css", "core.css"
)


def compile_assets(install_deps=False):
    try:
        if install_deps:
            subprocess.check_call(["npm", "ci"])
        subprocess.check_call(["npm", "run", "build"])
    except (OSError, subprocess.CalledProcessError) as e:
        print("Error compiling assets: " + str(e))  # noqa: T201
        raise SystemExit(1) from e


class sdist(base_sdist):
    def run(self):
        compile_assets()
        super().run()


class build_py(base_build_py):
    """Compile the admin assets when building a wheel, not only an sdist.

    Upstream compiles the frontend on the sdist path alone. A wheel built
    straight from a git checkout — exactly what `uv sync` does with a git
    dependency — therefore installs a Wagtail whose admin has no CSS or JS, and
    the editor is unusable. Rally Suite depends on this fork over git, so the
    wheel path has to build them too.

    Needs npm wherever the wheel is built. Skipped when the assets already
    exist, so building a wheel from an sdist (which compiled them on the way in)
    does not pay for npm twice.
    """

    def run(self):
        if not os.path.exists(COMPILED_ASSETS):
            compile_assets(install_deps=True)
        super().run()


setup(
    name="wagtail",
    cmdclass={"sdist": sdist, "build_py": build_py},
)
