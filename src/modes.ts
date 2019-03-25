/**
 * All the possibles modes in which Proxay can run.
 */
export type Mode = ReplayMode | RecordMode | MimicMode | PassthroughMode;

/**
 * Replays requests from tapes. Fails any unexpected requests.
 */
export type ReplayMode = "replay";

/**
 * Records requests. Ignores recorded tapes.
 */
export type RecordMode = "record";

/**
 * Records requests the first time it encounters them, then replays them.
 */
export type MimicMode = "mimic";

/**
 * Acts as a pass-through proxy. No recording occurs.
 */
export type PassthroughMode = "passthrough";
