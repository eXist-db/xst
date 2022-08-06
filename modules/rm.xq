xquery version "3.1";

(: required parameter :)
declare variable $paths as xs:string+ external;

(: options :)
(: declare variable $glob as xs:string external; :)
(: declare variable $dryrun as xs:boolean external; :)
declare variable $recursive as xs:boolean external;
declare variable $force as xs:boolean external;

declare variable $COLLECTION := "collection";
declare variable $RESOURCE := "resource";

declare function local:check-path ($path) {
    if (xmldb:collection-available($path))
    then $COLLECTION
    else if (util:binary-doc-available($path) or doc-available($path))
    then $RESOURCE
    else error(xs:QName('not_available'), $path || " does not exist")
};

declare function local:remove($path) {
    switch(local:check-path($path))
        case $COLLECTION return
            if (not($recursive))
            then error(xs:QName('non_recursive'), $path || " is a collection, but the recursive option is not set")
            else if (not($force) and exists((xmldb:get-child-resources($path), xmldb:get-child-collections($path))))
            then error(xs:QName('not_empty'), $path || " is a non-empty collection, but the force option is not set")
            else (xmldb:remove($path), true())
        case $RESOURCE return 
            let $parts := tokenize($path, '/')
            let $length := count($parts)
            let $resource := $parts[$length]
            let $collection := subsequence($parts, 1, $length - 1) => string-join('/')
            return (xmldb:remove($collection, $resource), true())
    default return error(xs:QName('unknown_type'), $path || " is of unknown type")
};

declare function local:safe-remove($path) {
    try {
        map {
            "path": $path,
            "success": local:remove($path)
        }
    }
    catch * {
        map {
            "path": $path,
            "success": false(),
            "error": map {
                "description": $err:description,
                "code": $err:code
            }
        }
    }
};

try {
    serialize(
        map{
            "list": array:for-each(
                array{ $paths }, local:safe-remove#1)
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
