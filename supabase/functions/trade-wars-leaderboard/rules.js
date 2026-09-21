/* Immutable rule source. Supabase resolves/bundles these public modules at
 * deployment. Changing the game's main branch cannot change score validation.
 * SHA-256 fingerprints of the rule files are in rules-manifest.json. */
export {createGame} from 'https://raw.githubusercontent.com/theNeighborrr/trade-wars/b0baa09cb21ad8c5a12292258078ff06bea5de5e/v06-engine.js';
