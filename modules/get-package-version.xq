xquery version "3.1";

declare namespace expath="http://expath.org/ns/pkg";
declare namespace repo="http://exist-db.org/xquery/repo";

declare variable $name-or-abbrev as xs:string external;

declare
function local:get-package-meta(
    $name as xs:string, $resource as xs:string
) as document-node()? {
    try {
        repo:get-resource($name, $resource)
        => util:binary-to-string() 
        => parse-xml()
    }
    catch * {
        ()
    }
};

declare
function local:find-by-abbrev($abbrev as xs:string, $expath as document-node()) as xs:boolean {
    $expath//@abbrev = $abbrev
};

declare
function local:find($name-or-abbrev) as document-node()? {
    let $list := repo:list()
    let $expaths := for-each($list, local:get-package-meta(?, "expath-pkg.xml"))

    return
        if ($name-or-abbrev = $list)
        then $expaths[index-of($name-or-abbrev, $list)]
        else filter($expaths, local:find-by-abbrev($name-or-abbrev, ?))
};

try {
    serialize(
        map { "version": local:find($name-or-abbrev)//expath:package/@version/string() },
        map { "method": "json" }
    )
}
catch * {
    serialize(
        map {
            "error": map {
                "code": $err:code,
                "description": $err:description,
                "value": $err:value,
                "module": $err:module,
                "line-number": $err:line-number,
                "column-number": $err:column-number,
                "additional": $err:additional,
                "xquery-stack-trace": $exerr:xquery-stack-trace
            }
        },
        map { "method": "json" }
    )
}
