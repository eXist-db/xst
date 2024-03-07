/**
 * @typedef { import("@existdb/node-exist").NodeExist } NodeExist
 */

/**
 * @typedef {Object} AccountInfo
 * @prop {Number} uid internal user id
 * @prop {String} name user name
 * @prop {String[]} groups the groups this user is a mebmer of
 * @prop {Number} umask default permissions when creating new resources and collections
 * @prop {Object} metadata additional user account information as URI-value pairs
 * @prop {Boolean} enabled is this user account enabled?
 * @prop {{id:number, name:string, realmId: string}} defaultGroup this user's default group info
 */

export const AdminGroup = 'dba'

/**
 * get the user account information for a specific user
 * @param {NodeExist} db client connection
 * @param {String} userName user name
 * @returns {Promise<AccountInfo>} user info object
 */
export async function getAccountInfo (db, userName) {
  const rawUserInfo = await db.users.getUserInfo(userName)
  const { uid, name, groups, umask, metadata } = rawUserInfo
  return {
    uid,
    name,
    groups,
    umask,
    metadata,
    enabled: Boolean(rawUserInfo.enabled),
    defaultGroup: {
      id: rawUserInfo['default-group-id'],
      name: rawUserInfo['default-group-name'],
      realmId: rawUserInfo['default-group-realmId']
    }
  }
}
