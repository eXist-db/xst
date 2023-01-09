xquery version "3.1";

declare namespace expath="http://expath.org/ns/pkg";
declare namespace repo="http://exist-db.org/xquery/repo";
declare namespace exist-pkg="http://exist-db.org/ns/expath-pkg";

declare
function local:get-package-meta(
    $package-uri as xs:string, $resource as xs:string
) as document-node()? {
    try {
        repo:get-resource($package-uri, $resource)
        => util:binary-to-string() 
        => parse-xml()
    }
    catch * {
        ()
    }
};

declare
function local:dependency ($dep as element(expath:dependency)?) as map(*) {
    map {
        "name": ($dep/(@package|@processor))[1]/string(),
        "semverMin": $dep/@semver-min/string(),
        "semverMax": $dep/@semver-max/string(),
        "semver": $dep/@semver/string(),
        "versions": array { tokenize($dep/@versions, ' ') }
    }
};

declare
function local:component($component as element()) as xs:string {
    $component/(expath:namespace|expath:import-uri|expath:public-uri)/string()
};

declare
function local:expath($package-uri as xs:string) as map(*) {
    let $expath := local:get-package-meta($package-uri, "expath-pkg.xml")
    let $extra := local:get-package-meta($package-uri, "exist.xml")

    let $jars :=
        if (exists($extra))
        then map { "jar": array { $extra//exist-pkg:jar/string() } }
        else ()

    let $components := 
        map {
            "xslt": array { for-each($expath//expath:xslt, local:component#1 ) },
            "xquery": array {
                for-each($expath//expath:xquery, local:component#1),
                if (exists($extra))
                then $extra//exist-pkg:java/exist-pkg:namespace/string()
                else ()
            },
            "xproc": array { for-each($expath//expath:xproc, local:component#1 ) },
            "xsd": array { for-each($expath//expath:xsd, local:component#1 ) },
            "rng": array { for-each($expath//expath:rng, local:component#1 ) },
            "schematron": array { for-each($expath//expath:schematron, local:component#1 ) },
            "nvdl": array { for-each($expath//expath:nvdl, local:component#1 ) },
            "resource": array { for-each($expath//expath:resource, local:component#1 ) }
            (: ,"dtd": array { for-each($expath//expath:dtd, local:component#1 ) } :)
        }

    return
        map {
            "name": $expath//@name,
            "abbrev": $expath//@abbrev/string(),
            "version": $expath//expath:package/@version/string(),
            "title": $expath//expath:title/text(),
            "processor": local:dependency($expath//expath:dependency[@processor]),
            "dependencies": array {
                for-each($expath//expath:dependency[@package],
                    local:dependency#1)
            },
            "components": map:merge(($components, $jars))
            (: ,"expath": $expath :)
        }
};

declare
function local:repo($package-uri as xs:string) as map(*) {
    let $repo := local:get-package-meta($package-uri, "repo.xml")

    return
        map {
            "website": $repo//repo:website/text(),
            "description": $repo//repo:description/text(),
            "license": $repo//repo:license/text(),
            "authors": array{ $repo//repo:author/text() },
            "type": $repo//repo:type/text(),
            "target": $repo//repo:target/text()
            (: ,"repo": $repo :)
        }
};

declare
function local:get-deployment-date ($expath, $repo) {
    let $doc :=
        if ($repo?target)
        then doc('/db/apps/' || $repo?target || '/repo.xml')
        else doc('/db/system/repo/' || $expath?abbrev || '-' || $expath?version || '/repo.xml')

    return $doc//repo:deployed/text()
};

declare
function local:meta($package-uri as xs:string) as map(*) {
    let $expath := local:expath($package-uri)
    let $repo := local:repo($package-uri)

    let $date := local:get-deployment-date($expath, $repo)

    return map:merge((
        map { "uri": $package-uri, 'date': $date },
        $expath,
        $repo
    ))
};

serialize(
    map {
        "packages": array {
            for-each(repo:list(), local:meta#1)
        }
    },
    map { "method": "json" }
)
