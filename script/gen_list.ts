const fs = require('fs')
import { getOpenseaCollectionAddresses } from "./opesea_contrats"

import {
    Ethereum,
    isPathExistsSync,
    getChainAssetsPath,
    chainsFolderPath,
    readDirSync,
    readFileSync,
    isChainWhitelistExistSync,
    isChainBlacklistExistSync,
    getChainWhitelistPath,
    getChainBlacklistPath,
    writeFileSync,
    sortDesc,
    getUnique,
    mapList
} from '../src/test/helpers'

const assetsChains = readDirSync(chainsFolderPath).filter(chain => isPathExistsSync(getChainAssetsPath(chain)))

assetsChains.forEach(async chain => {
    const assets = readDirSync(getChainAssetsPath(chain))

    const whitelistPath = getChainWhitelistPath(chain)
    const blacklistPath = getChainBlacklistPath(chain)

    //Create inital lists if they do not exists 
    if (!isChainWhitelistExistSync(chain)) {
        writeFileSync(whitelistPath, `[]`)
    }

    if (!isChainBlacklistExistSync(chain)) {
        writeFileSync(blacklistPath, `[]`)
    }

    const currentWhitelist = assets.concat(JSON.parse(readFileSync(whitelistPath)))
    let currentBlacklist = JSON.parse(readFileSync(blacklistPath))

    // Some chains required pulling lists from other sources
    switch (chain) {
        case Ethereum:
            const nftList = await getOpenseaCollectionAddresses()
            currentBlacklist = currentBlacklist.concat(nftList)
            break;
        default:
            break;
    }

    const mappedWhiteList = mapList(currentWhitelist)
    const mappedBlackList = mapList(currentBlacklist)

    // Make sure whitelist do not contain assets from blacklist and oposite
    const filteredWhitelist = currentWhitelist.filter(a => !mappedBlackList[a])
    const filteredBlacklist = currentBlacklist.filter(a => !mappedWhiteList[a])
    
    const finalWhiteList = sortDesc(getUnique(filteredWhitelist))
    const finalBlackList = sortDesc(getUnique(filteredBlacklist))

    fs.writeFileSync(whitelistPath, JSON.stringify(finalWhiteList, null, 4))
    fs.writeFileSync(blacklistPath, JSON.stringify(finalBlackList, null, 4))
})


