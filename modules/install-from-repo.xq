xquery version "3.1";

declare namespace expath="http://expath.org/ns/pkg";

declare variable $packageName external;
declare variable $publicRepoURL external;
declare variable $version external;

declare variable $latest := $version eq '';

declare function local:remove-package ($package-name as xs:string) as empty-sequence() {
    if (not($package-name = repo:list()))
    then ()
    else if (
        repo:undeploy($package-name)/@result = "ok"
        and repo:remove($package-name)
    )
    then ()
    else (
        error(xs:QName("installation-error"),
            "existing installation of package " || $package-name || " could not removed")
    )
};

try {
    let $guard := local:remove-package($packageName)

    let $installation :=
        if ($latest)
        then repo:install-and-deploy(
            $packageName,
            $publicRepoURL || "/find"
        )
        else repo:install-and-deploy(
            $packageName,
            $version,
            $publicRepoURL || "/find"
        )

    return
    serialize(
        map {
            "success": ($installation/@result = "ok"),
            "result": map {
                "version": $version,
                "target": $installation/@target/string()
            }
        }, 
        map { "method": "json" }
    )
}
catch * {
    serialize(
        map {
            "success": false(),
            "error": map {
                "code": $err:code,
                "description": $err:description,
                "value": $err:value,
                "module": $err:module,
                "line": $err:line-number
                (: "column": $err:column :)
            }
        }, 
        map { "method": "json" }
    )
}
