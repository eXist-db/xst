xquery version "3.1";

declare function local:info () as map(*) {
    map {
        "db": map {
            "name": system:get-product-name(),
            "version": system:get-version(),
            "git": system:get-revision()
        },
        "java": map {
            "vendor": util:system-property("java.vendor"),
            "version": util:system-property("java.version")
        },
        "os": map {
            "name": util:system-property("os.name"),
            "version": util:system-property("os.version"),
            "arch": util:system-property("os.arch")
        }
    }
};

try {
    serialize(
        local:info(),
        map { "method": "json" })
}
catch * {
    let $error :=
        map {
            "code": $err:code,
            "description": $err:description,
            "value": $err:value,
            "module": $err:module,
            "line-number": $err:line-number,
            "column-number": $err:column-number,
            "additional": $err:additional,
            "xquery-stack-trace": $exerr:xquery-stack-trace
        }

    return
        serialize(
            map { "error": $error },
            map { "method": "json" })
}
