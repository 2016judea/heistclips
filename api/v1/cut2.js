// A second lane for the server cut: the same handler as cut.js under another path, so it runs
// in its own function instance with its own CPU. Cuts that overlap in time are sent to
// different lanes by the connector (api/mcp.js cutLane) instead of queuing on one instance.
export { default } from "./cut.js";
