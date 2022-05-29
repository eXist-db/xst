xquery version "3.1";

declare variable $collection external;
declare variable $level external;

declare function local:get-descendant-resources ($collection, $current-level) {
    for $sc in xmldb:get-child-collections($collection)
    let $p := concat($collection, "/", $sc)
    return
        map {
        "type": "collection",
        "name": $sc,
        "path": $p,
        "children": array {
            if ($level = 0 or $level > $current-level)
            then (local:get-descendant-resources($p, $current-level + 1))
            else ()
            ,
            if ($level = 0 or $level > $current-level)
            then (
            for $r in xmldb:get-child-resources($p)
            return map { 
                "type": "resource",
                "name": $r,
                "path": concat($p, "/", $r)
            }
            )
            else ()
        }
    }
};

declare function local:tree ($base) {
    map {
        "type": "collection",
        "name": replace($base, ".*/(.+)?", "$1"),
        "path": $base,
        "children": array {
            local:get-descendant-resources($base, 1)
        }
    }
};

serialize(local:tree($collection), map{"method": "json"})
