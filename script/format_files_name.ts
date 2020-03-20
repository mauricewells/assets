import {
    ethSidechains,
    readDirSync,
    getChainAssetsPath,
    getChainAssetFilesList,
    isChecksum,
    toChecksum,
    getFileName,
    getFileExt,
    getMoveCommandFromTo,
    execRename,
    logoName,
    logoExtension,
    logo,
    getChainAssetPath
} from "../src/test/helpers"

ethSidechains.forEach(chain => {
    const assetsPath = getChainAssetsPath(chain)
    const chainAddresses = readDirSync(assetsPath)

    chainAddresses.forEach(address => {
        checksumAssetsFolder(assetsPath, address)

        getChainAssetFilesList(chain, address).forEach(file => {
            if (getFileName(file) == logoName && getFileExt(file) !== logoExtension) {
                console.log(`Renaming incorrect asset logo extension ${file} ...`)
                renameAndMove(getChainAssetPath(chain, address), file, logo)
            }
        })
    })
})

export function checksumAssetsFolder(assetsFolderPath: string, addr: string) {
    if (!isChecksum(addr)) {
        const checksumAddr = toChecksum(addr)
        renameAndMove(assetsFolderPath, addr, checksumAddr)
    }
}

export function renameAndMove(path: string, oldName: string, newName: string) {
    console.log(`   Renaming file or folder at path ${path}: ${oldName} => ${newName} ...`)
    const renamed = execRename(path, getMoveCommandFromTo(oldName, newName))
    console.log(`       Result renaming: ${renamed}`)
}

