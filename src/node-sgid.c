#include <unistd.h>
#include <stdio.h>
#include <limits.h>
#include <libgen.h>

int main(int argc, char* argv[]) {
    char exepath[PATH_MAX] = {};
    // won't append a terminating null byte
    if (readlink("/proc/self/exe", exepath, PATH_MAX) < 0) return 3;

    // may modify arg string, and return a string in static mem zone
    char* dirpath = dirname(exepath);

    char scriptpath[PATH_MAX * 2];
    sprintf(scriptpath, "%s/script.js", exepath);

    if (execle(
        "/usr/local/bin/node",
        "/usr/local/bin/node",
        "--experimental-specifier-resolution=node",
        "--enable-source-maps",
        scriptpath,
        (char*)NULL,
        (char**)NULL
    ) < 0) return 3;
}
