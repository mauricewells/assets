import { sanityCheckAll } from "../action/update-all";

export async function main() {
    try {
        const errors = await sanityCheckAll();
        process.exit(errors.length);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}

main();
