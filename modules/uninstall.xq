xquery version "3.1";

declare namespace expath="http://expath.org/ns/pkg";
declare namespace repo="http://exist-db.org/xquery/repo";

declare variable $name-or-abbrev as xs:string external;
declare variable $force as xs:boolean external;

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
function local:find($name-or-abbrev, $list, $expaths) {
    if ($name-or-abbrev = $list)
    then $name-or-abbrev
    else
        let $by-abbrev :=
            filter($expaths, local:find-by-abbrev($name-or-abbrev, ?))
            //@name/string()
        return
            if (empty($by-abbrev))
            then error(
                xs:QName("local:NOT_FOUND"), 
                "Package '" || $name-or-abbrev || "' not found."
            )
            else $by-abbrev
};

declare
function local:dependency-check($expaths, $name) {
    let $dependents :=
        filter($expaths, function ($expath) {
            $name = $expath//expath:dependency/@package/string()
        })

    return
        empty($dependents) or 
        error(
            xs:QName("local:DEPENDENTS_FOUND"),
            "Package '" || $name-or-abbrev || "' has dependents",
            array { $dependents//@abbrev }
        )
};


try {
    let $list := repo:list()
    let $expaths := for-each($list, local:get-package-meta(?, "expath-pkg.xml"))
    let $name := local:find($name-or-abbrev, $list, $expaths)
    let $check := 
        if ($force)
        then ()
        else local:dependency-check($expaths, $name)

    let $undeploy := repo:undeploy($name)//@result = 'ok'
    let $remove := repo:remove($name)
    return
        serialize(
            map {
                "name": $name,
                "force": $force,
                "undeploy": $undeploy,
                "remove": $remove
            },
            map { "method": "json" }
        )
}
catch local:DEPENDENTS_FOUND | local:NOT_FOUND {
    serialize(
        map {
            "error": map {
                "code": $err:code,
                "description": $err:description,
                "value": $err:value
            }
        },
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
