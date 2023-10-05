xquery version "3.1";

(: required parameter :)
declare variable $collection as xs:string external;

(: options :)
declare variable $glob as xs:string? external;
declare variable $depth as xs:integer? external;
declare variable $recursive as xs:boolean? external;
declare variable $collections-only as xs:boolean? external;


declare function local:glob-to-regex ($glob as xs:string) as xs:string {
    let $pattern := 
        $glob
        => replace("\.", "\\.")
        => replace("(\*|\?)", ".$1")

    return concat("^", $pattern, "$")
};

declare function local:get-filter ($glob as xs:string?) as function(xs:string) as xs:boolean {
    if (not(exists($glob)) or $glob = ("*"))
    then function ($_) { true() }
    else (
        let $regex := local:glob-to-regex($glob)
        return matches(?, $regex)
    )
};

(: always query extended info for sorting :)
declare function local:get-item-info ($type as xs:string, $collection as xs:string, $name as xs:string) as map(*) {
    let $path := $collection || "/" || $name
    let $uri := xs:anyURI($path)

    return map:merge((
        map {
            "type": $type,
            "name": $name,
            "path": $path
        },
        local:get-permissions($uri),
        if ($type = "collection")
        then (local:get-collection-size-and-created-date($path))
        else (local:get-resource-size-and-last-modified-date($collection, $name))
    ))
};

declare function local:get-permissions($uri as xs:anyURI) as map(*) {
    let $perm := sm:get-permissions($uri)/sm:permission

    return map {
        "mode": $perm/@mode/string(),
        "owner": $perm/@owner/string(),
        "group": $perm/@group/string()
    }
};

declare function local:get-resource-size-and-last-modified-date ($collection as xs:string, $resource as xs:string) as map(*) {
    map {
        "size": xmldb:size($collection, $resource),
        "modified": xmldb:last-modified($collection, $resource),
        "created": xmldb:created($collection, $resource)
    }
};

declare function local:get-collection-size-and-created-date ($collection as xs:string) as map(*) {
    map {
        "size": 0,
        "modified": xmldb:created($collection), (: collections do not seem to have a mtime :)
        "created": xmldb:created($collection)
    }
};

declare function local:list-sub-collection ($sub-collection as xs:string, $collection as xs:string, $current-level as xs:integer, $options as map(*)) as map(*)? {
    try {
        let $path := concat($collection, "/", $sub-collection)
        let $children := local:get-children($path, $current-level, $options)
        (: this should work but does not in 6.1.0-SNAPSHOT :)
        (: let $name-matches := $options?item-filter($sub-collection) :)
        let $name-matches := matches($sub-collection, $options?pattern)
        let $has-children := exists($children) and array:size($children?children) > 0
        return
            if ($name-matches or $has-children)
            then map:merge((
                local:get-item-info("collection", $collection, $sub-collection),
                $children
            ))
            else ()
    }
    catch * {
        util:log("error", $err:description)
    }
};

declare function local:list-collections ($collection as xs:string, $current-level as xs:integer, $options as map(*)) as map(*)* {
    for-each(
        xmldb:get-child-collections($collection),
        local:list-sub-collection(?, $collection, $current-level, $options))
};

declare function local:list-resources ($collection, $options) {
    if ($options?collections-only)
    then ()
    else 
        let $resources := filter(xmldb:get-child-resources($collection), $options?item-filter)
        for $resource in $resources
        return local:get-item-info("resource", $collection, $resource)
};

(: recursive :)
declare function local:get-children ($collection as xs:string, $current-level as xs:integer, $options as map(*)) {
    if (not($options?recursive))
    then ()
    else if ($options?depth = 0 or $options?depth > $current-level)
    then
        map {
            "children": array {
                local:list-resources($collection, $options),
                local:list-collections($collection, $current-level + 1, $options)
            }
        }
    else map { "children": [] }
};

declare function local:list ($collection as xs:string, $options as map(*)) as map(*) {
    let $normalized-collection := replace($collection, "^(.+?)/?$", "$1")
    let $parent-collection := replace($normalized-collection, "(/[^/]+)$", "")
    let $collection-name := replace($normalized-collection, "^(.*?/)([^/]+)$", "$2")
    return
        map:merge((
            local:get-item-info("collection", $parent-collection, $collection-name),
            map {
                "children": array {
                    local:list-resources($normalized-collection, $options),
                    local:list-collections($normalized-collection, 1, $options)
                }
            }
        ))
};

try {
    if (xmldb:collection-available($collection))
    then (
        let $options := map {
            "collections-only": ($collections-only, false())[1],
            "depth": ($depth, 0)[1],
            "recursive": ($recursive, true())[1],
            "pattern": local:glob-to-regex($glob),
            "item-filter": local:get-filter($glob)
        }

        let $list := local:list($collection, $options)

        return serialize($list, map { "method": "json" })
    )
    else (
        error(xs:QName('not_available'), 'Collection "' || $collection || '" not found!')
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
