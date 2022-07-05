xquery version "3.1";

declare variable $to-json := serialize(?, map{"method":"json"});
(:
<sm:id xmlns:sm="http://exist-db.org/xquery/securitymanager">
    <sm:real>
        <sm:username>guest</sm:username>
        <sm:groups>
            <sm:group>guest</sm:group>
        </sm:groups>
    </sm:real>
    <sm:effective>
        <sm:username>guest</sm:username>
        <sm:groups>
            <sm:group>guest</sm:group>
        </sm:groups>
    </sm:effective>
</sm:id> 
:)

declare variable $user-info := function ($user-element as element()?) as map(*)? {
    if (exists($user-element))
    then 
        map {
            "user": $user-element/sm:username/text(),
            "groups": array { $user-element//sm:group/text() }
        }
    else ()
};

try {
    let $identity := sm:id()/sm:id

    return $to-json(map {
        "real": $user-info($identity/sm:real),
        "effective": $user-info($identity/sm:effective)
    })
}
catch * {
    $to-json(map {
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
    })
}
