# xst [ĭg-zĭst′]

Command line tool to interact with exist-db instances.

Built on top of [@existdb/node-exist](https://www.npmjs.com/package/@existdb/node-exist).

## Installation

Until this package is officially released you can already use
it by following the steps below

1. clone this repository
    ```bash
    git clone https://github.com/eXist-db/xst
    ```

2. change to the working directory
    ```bash
    cd xst
    ```

3. install package dependencies
    ```bash
    npm install
    ```

4. link this package into your global packages directory
    ```bash
    npm link
    ```

## Usage

```bash
xst <command>
```

You can verify your installation is working with

```bash
xst --version
```

This will output `0.0.0-development` for the moment.

```bash
xst --help
```

will output all available commands and 

```bash
xst <command> --help
```

will output useful information how to use each of the commands.

**Available Commands**

Currently all command line examples from node-exist were ported over:

- `list` list the contents of a collection in eXist-db
- `tree` list the contents of a collection in eXist-db as a tree
- `upload` upload a files and folders to a collection in eXist-db
- `install` upload and install a package into eXist-db
- `execute` execute queries in an eXist-db

**Example**

```bash
xst install path/to/my-package.xar
```

Installs a local XAR package into any database you have access to (with all its declared dependencies).

## Configuration

By default `xst` connects to https://localhost:8443 as user admin. 

**NOTE:** The instance you want to connect to must be running and XML-RPC has to be enabled.

Override any of the default connection parameters by setting environment 
variables prefixed with `EXISTDB`. In the following table you see a list of the 
parameters with their default values and a description.

| variable name | default | description
|----|----|----
| `EXISTDB_USER` | `admin` | the user used to connect to the database and to execute queries with
| `EXISTDB_PASS` | _empty_ | the password to authenticate the user against the database
| `EXISTDB_SERVER` | `https://localhost:8443` | the URL of the database instance to connect to (only http and https protocols are allowed)

**Example**

```
EXISTDB_SERVER=http://127.0.0.1:8080 xst ls /db/apps
```

## dotenv

dotenv(-cli) is a small script that allows you to read environment variables from a file in the filesystem.

### preparation

- Install [dotenv-cli](https://www.npmjs.com/package/dotenv-cli) globally
    ```bash
    npm install -g dotenv-cli
    ```

- create .env file in a folder with the settings that you need
    ```bash
    EXISTDB_USER=admin
    EXISTDB_PASS=my super secret p455w0rd!
    EXISTDB_SERVER=http://localhost:8080
    ```

### use

prepend command line script with `dotenv` in the folder you created the .env file in

#### Examples

```bash
dotenv xst ls /db/apps
```

**Note** in order to pass options to `xst` you will need to separate dotenv with `--` from the
actual command.

```bash
dotenv -- xst ls --extended --color /db/apps
```

That also works when running the tests (on a remote server maybe or a different user)

```bash
dotenv npm test
```

#
