xquery version "3.1";
declare variable $collection as xs:string external;
declare variable $glob as xs:string external;
declare variable $extended as xs:boolean external;

declare function local:glob-to-regex ($glob as xs:string) as xs:string {
    let $pattern := 
        $glob
        => replace("\\.", "\\\\.")
        => replace("(\\*|\\?)", ".$1")

    return concat("^", $pattern, "$")
};

declare function local:get-item-info ($type as xs:string, $child as xs:string) as map(*) {
    map {
        "type": $type,
        "name": $child
    }
};

declare function local:get-extended-info ($type as xs:string, $child as xs:string) as map(*) {
    let $path := xs:anyURI($collection || "/" || $child)
    let $perm := sm:get-permissions($path)/sm:permission
    let $e := 
        if ($type = "collection")
        then map {
            "size": 0,
            "modified": xmldb:created($path)
        }
        else map {
            "size": xmldb:size($collection, $child),
            "modified": xmldb:last-modified($collection, $child)
        }

    return map:merge((
        map {
            "type": $type,
            "name": $child,
            "mode": $perm/@mode/string(),
            "owner": $perm/@owner/string(),
            "group": $perm/@group/string()
        },
        $e
    ))
};

declare function local:get-mapping-function ($type as xs:string, $glob as xs:string?) as function(xs:string) as map(*) {
    if ($glob = ("*", "**") and $extended)
    then (
        local:get-extended-info($type, ?)
    )
    else if ($glob = ("*", "**"))
    then (
        local:get-item-info($type, ?)
    )
    else (
        let $pattern := local:glob-to-regex($glob)
        let $get-info-for :=
            if ($extended)
            then local:get-extended-info($type, ?)
            else local:get-item-info($type, ?)

        return
            function ($child as xs:string) {
                if (matches($child, $pattern))
                then $get-info-for($child)
                else ()
            }
    )

};


if (xmldb:collection-available($collection))
then (
    let $list := array {
        for-each(
            xmldb:get-child-collections($collection),
            local:get-mapping-function("collection", $glob)
        ),
        for-each(
            xmldb:get-child-resources($collection),
            local:get-mapping-function("resource", $glob)
        )
    }
    return serialize($list, map { "method": "json" })
)
else serialize(
    map { "error": 'Collection "' || $collection || '" not found!' }, 
    map { "method": "json" }
)
