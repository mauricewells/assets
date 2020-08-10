import axios from "axios";
import * as bluebird from "bluebird";
import * as fs from "fs";
import * as path from "path";
import * as chalk from 'chalk';
import * as config from "../common/config";
import { ActionInterface, CheckStepInterface } from "./interface";
import { getChainAssetsPath } from "../common/repo-structure";
import { Binance } from "../common/blockchains";
import { readDirSync } from "../common/filesystem";

import {
    getChainAssetLogoPath,
    getChainBlacklistPath
} from "../common/repo-structure";

const binanceChain = "binance"
const binanceUrlTokens2 = config.getConfig("binance_url_tokens2", "https://dex-atlantic.binance.org/api/v1/tokens?limit=1000");
const binanceUrlTokens8 = config.getConfig("binance_url_tokens8", "https://dex-atlantic.binance.org/api/v1/mini/tokens?limit=1000");
const binanceUrlTokenAssets = config.getConfig("binance_url_token_assets", "https://explorer.binance.org/api/v1/assets?page=1&rows=1000");
var cachedAssets = [];

async function retrieveBep2AssetList(): Promise<any[]> {
    console.log(`     Retrieving token asset infos from: ${binanceUrlTokenAssets}`);
    const { assetInfoList } = await axios.get(binanceUrlTokenAssets).then(r => r.data);
    console.log(`     Retrieved ${assetInfoList.length} token asset infos`);
    return assetInfoList
}

async function retrieveAssets(): Promise<any[]> {
    // cache results because of rate limit, used more than once
    if (cachedAssets.length == 0) {
        console.log(`     Retrieving token infos (${binanceUrlTokens2}, ${binanceUrlTokens8})`);
        const bep2assets = await axios.get(binanceUrlTokens2);
        const bep8assets = await axios.get(binanceUrlTokens8);
        cachedAssets = bep2assets.data.concat(bep8assets.data);
    }
    console.log(`     Using ${cachedAssets.length} assets`);
    return cachedAssets;
}

export async function retrieveAssetSymbols(): Promise<string[]> {
    const assets = await retrieveAssets();
    const symbols = assets.map(({ symbol }) => symbol);
    return symbols;
}

function fetchImage(url) {
    return axios.get(url, { responseType: "stream" })
        .then(r => r.data)
        .catch(err => {
            throw `Error fetchImage: ${url} ${err.message}`;
        });
}

/// Return: array with images to fetch; {asset, assetImg}
export function findImagesToFetch(assetInfoList: any, blacklist: string[]): any[] {
    let toFetch: any[] = [];
    console.log(`Checking for asset images to be fetched`);
    assetInfoList.forEach(({asset, assetImg}) => {
        process.stdout.write(`.${asset} `);
        if (assetImg) {
            if (blacklist.indexOf(asset) != -1) {
                console.log();
                console.log(`${asset} is blacklisted`);
            } else {
                const imagePath = getChainAssetLogoPath(binanceChain, asset);
                if (!fs.existsSync(imagePath)) {
                    console.log(chalk.red(`Missing image: ${asset}`));
                    toFetch.push({asset, assetImg});
                }
            }
        }
    });
    console.log();
    console.log(`${toFetch.length} asset image(s) to be fetched`);
    return toFetch;
}


async function fetchMissingImages(toFetch: any[]): Promise<string[]> {
    console.log(`Attempting to fetch ${toFetch.length} asset image(s)`);
    let fetchedAssets: string[] = [];
    await bluebird.each(toFetch, async ({ asset, assetImg }) => {
        if (assetImg) {
            const imagePath = getChainAssetLogoPath(binanceChain, asset);
            fs.mkdir(path.dirname(imagePath), err => {
                if (err && err.code != `EEXIST`) throw err;
            });
            await fetchImage(assetImg).then(buffer => {
                buffer.pipe(fs.createWriteStream(imagePath));
                fetchedAssets.push(asset)
                console.log(`Fetched image ${asset} ${imagePath} from ${assetImg}`)
            });
        }
    });
    console.log();
    return fetchedAssets;
}

export class BinanceAction implements ActionInterface {
    getName(): string { return "Binance chain"; }

    getSanityChecks(): CheckStepInterface[] {
        return [
            {
                getName: () => { return "Binance chain; assets must exist on chain"},
                check: async () => {
                    var error: string = "";
                    const tokenSymbols = await retrieveAssetSymbols();
                    const assets = readDirSync(getChainAssetsPath(Binance));
                    assets.forEach(asset => {
                        if (!(tokenSymbols.indexOf(asset) >= 0)) {
                            error += `Asset ${asset} missing on chain\n`;
                        }
                    });
                    console.log(`     ${assets.length} assets checked.`);
                    return error;
                }
            },
        ];
    }

    getConsistencyChecks = null;

    sanityFix = null;

    consistencyFix = null;
    
    async update(): Promise<void> {
        // retrieve missing token images; BEP2 (bep8 not supported)
        const bep2InfoList = await retrieveBep2AssetList();
        const blacklist: string[] = require(getChainBlacklistPath(binanceChain));

        const toFetch = findImagesToFetch(bep2InfoList, blacklist);
        const fetchedAssets = await fetchMissingImages(toFetch);

        if (fetchedAssets.length > 0) {
            console.log(`Fetched ${fetchedAssets.length} asset(s):`);
            fetchedAssets.forEach(asset => console.log(`  ${asset}`));
        }
    }
}
