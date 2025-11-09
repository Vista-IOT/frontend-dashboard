const { OPCUAClient } = require("node-opcua");

const endpointUrl = process.argv[2] || "opc.tcp://localhost:4840";

(async () => {
  try {
    const client = OPCUAClient.create({
      endpointMustExist: false,
    });

    console.log("Connecting to", endpointUrl);
    await client.connect(endpointUrl);

    const session = await client.createSession();
    console.log("✅ Connected and session created.");

    const browseResult = await session.browse("RootFolder");
    console.log("📁 RootFolder contents:");
    browseResult.references.forEach(ref => {
      console.log(" -", ref.browseName.toString());
    });

    await session.close();
    await client.disconnect();
    console.log("✅ Disconnected cleanly.");
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
