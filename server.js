const express = require("express");
const cors = require("cors");
const deployAsset = require("./utils/deployDynamicAsset");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/deploy-asset", async (req, res) => {
  try {
    const { type, initialSupply, uri } = req.body;

    if (!type) return res.status(400).json({ success: false, message: "Asset type is required" });

    const params = {};
    if (type === "ERC20") {
      if (!initialSupply) return res.status(400).json({ success: false, message: "Initial supply required for ERC20" });
      params.initialSupply = initialSupply;
    } else if (type === "ERC1155") {
      if (!uri) return res.status(400).json({ success: false, message: "URI required for ERC1155" });
      params.uri = uri;
    }

    const contractAddress = await deployAsset(type, params);
    return res.json({ success: true, message: `${type} deployed successfully!`, contractAddress });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = 4000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
