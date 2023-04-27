'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
var sanity = require('sanity');
var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var icons = require('@sanity/icons');
var studioSecrets = require('@sanity/studio-secrets');
var ui = require('@sanity/ui');
var mapLimit = require('async/mapLimit');
var asyncify = require('async/asyncify');
var mutator = require('@sanity/mutator');
var dset = require('dset');
var assetUtils = require('@sanity/asset-utils');
function _interopDefaultCompat(e) {
  return e && typeof e === 'object' && 'default' in e ? e : {
    default: e
  };
}
var React__default = /*#__PURE__*/_interopDefaultCompat(React);
var mapLimit__default = /*#__PURE__*/_interopDefaultCompat(mapLimit);
var asyncify__default = /*#__PURE__*/_interopDefaultCompat(asyncify);
function createInitialMessage() {
  let docCount = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
  let refsCount = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  const message = [docCount === 1 ? "This Document contains" : "These ".concat(docCount, " Documents contain"), refsCount === 1 ? "1 Reference." : "".concat(refsCount, " References."), refsCount === 1 ? "That Document" : "Those Documents", "may have References too. If referenced Documents do not exist at the target Destination, this transaction will fail."];
  return message.join(" ");
}
const stickyStyles = function () {
  let isDarkMode = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
  return {
    position: "sticky",
    top: 0,
    zIndex: 100,
    backgroundColor: isDarkMode ? "rgba(10,10,10,0.95)" : "rgba(255,255,255,0.95)"
  };
};
async function getDocumentsInArray(options) {
  const {
    fetchIds,
    client,
    pluginConfig,
    currentIds,
    projection
  } = options;
  const collection = [];
  const filter = ["_id in $fetchIds", pluginConfig.filter].filter(Boolean).join(" && ");
  const query = "*[".concat(filter, "]").concat(projection != null ? projection : "");
  const data = await client.fetch(query, {
    fetchIds: fetchIds != null ? fetchIds : []
  });
  if (!(data == null ? void 0 : data.length)) {
    return [];
  }
  const localCurrentIds = currentIds != null ? currentIds : /* @__PURE__ */new Set();
  const newDataIds = new Set(data.map(dataDoc => dataDoc._id).filter(id => (currentIds == null ? void 0 : currentIds.size) ? !localCurrentIds.has(id) : Boolean(id)));
  if (newDataIds.size) {
    collection.push(...data);
    localCurrentIds.add(...newDataIds);
    await Promise.all(data.map(async doc => {
      const expr = ".._ref";
      const references = mutator.extractWithPath(expr, doc).map(ref => ref.value);
      if (references.length) {
        const newReferenceIds = new Set(references.filter(ref => !localCurrentIds.has(ref)));
        if (newReferenceIds.size) {
          const referenceDocs = await getDocumentsInArray({
            fetchIds: Array.from(newReferenceIds),
            currentIds: localCurrentIds,
            client,
            pluginConfig
          });
          if (referenceDocs == null ? void 0 : referenceDocs.length) {
            collection.push(...referenceDocs);
          }
        }
      }
    }));
  }
  const uniqueCollection = collection.filter(Boolean).reduce((acc, cur) => {
    if (acc.some(doc => doc._id === cur._id)) {
      return acc;
    }
    return [...acc, cur];
  }, []);
  return uniqueCollection;
}
const buttons = ["All", "None", null, "New", "Existing", "Older", null, "Documents", "Assets"];
function SelectButtons(props) {
  const {
    payload,
    setPayload
  } = props;
  const [disabledActions, setDisabledActions] = React.useState([]);
  React.useEffect(() => {
    if (!(disabledActions == null ? void 0 : disabledActions.length) && payload.every(item => item.include)) {
      setDisabledActions(["ALL"]);
    }
  }, [disabledActions == null ? void 0 : disabledActions.length, payload]);
  function handleSelectButton(action) {
    if (!action || !payload.length) return;
    const newPayload = [...payload];
    switch (action) {
      case "ALL":
        newPayload.map(item => item.include = true);
        break;
      case "NONE":
        newPayload.map(item => item.include = false);
        break;
      case "NEW":
        newPayload.map(item => item.include = Boolean(item.status === "CREATE"));
        break;
      case "EXISTING":
        newPayload.map(item => item.include = Boolean(item.status === "EXISTS"));
        break;
      case "OLDER":
        newPayload.map(item => item.include = Boolean(item.status === "OVERWRITE"));
        break;
      case "ASSETS":
        newPayload.map(item => item.include = assetUtils.isAssetId(item.doc._id));
        break;
      case "DOCUMENTS":
        newPayload.map(item => item.include = !assetUtils.isAssetId(item.doc._id));
        break;
    }
    setDisabledActions([action]);
    setPayload(newPayload);
  }
  return /* @__PURE__ */jsxRuntime.jsx(ui.Card, {
    padding: 1,
    radius: 3,
    shadow: 1,
    children: /* @__PURE__ */jsxRuntime.jsx(ui.Flex, {
      gap: 2,
      children: buttons.map((action, actionIndex) => action ? /* @__PURE__ */jsxRuntime.jsx(ui.Button, {
        fontSize: 1,
        mode: "bleed",
        padding: 2,
        text: action,
        disabled: disabledActions.includes(action.toUpperCase()),
        onClick: () => handleSelectButton(action.toUpperCase())
      }, action) :
      // eslint-disable-next-line react/no-array-index-key
      /* @__PURE__ */
      jsxRuntime.jsx(ui.Card, {
        borderLeft: true
      }, "divider-".concat(actionIndex)))
    })
  });
}
const documentTones = {
  EXISTS: "primary",
  OVERWRITE: "critical",
  UPDATE: "caution",
  CREATE: "positive",
  UNPUBLISHED: "caution"
};
const assetTones = {
  EXISTS: "critical",
  OVERWRITE: "critical",
  UPDATE: "critical",
  CREATE: "positive",
  UNPUBLISHED: "default"
};
const documentMessages = {
  // Only happens once document is copied the first time, and _updatedAt is the same
  EXISTS: "This document already exists at the Destination with the same ID with the same Updated time.",
  // Is true immediately after transaction as _updatedAt is updated by API after mutation
  // Is also true if the document at the destination has been manually modified
  // Presently, the plugin doesn't actually compare the two documents
  OVERWRITE: "A newer version of this document exists at the Destination, and it will be overwritten with this version.",
  // Document at destination is older
  UPDATE: "An older version of this document exists at the Destination, and it will be overwritten with this version.",
  // Document at destination doesn't exist
  CREATE: "This document will be created at the destination.",
  UNPUBLISHED: "A Draft version of this Document exists in this Dataset, but only the Published version will be duplicated to the destination."
};
const assetMessages = {
  EXISTS: "This Asset already exists at the Destination",
  OVERWRITE: "This Asset already exists at the Destination",
  UPDATE: "This Asset already exists at the Destination",
  CREATE: "This Asset does not yet exist at the Destination",
  UNPUBLISHED: ""
};
const assetStatus = {
  EXISTS: "RE-UPLOAD",
  OVERWRITE: "RE-UPLOAD",
  UPDATE: "RE-UPLOAD",
  CREATE: "UPLOAD",
  UNPUBLISHED: ""
};
function StatusBadge(props) {
  const {
    status,
    isAsset
  } = props;
  if (!status) {
    return null;
  }
  const badgeTone = isAsset ? assetTones[status] : documentTones[status];
  if (!badgeTone) {
    return /* @__PURE__ */jsxRuntime.jsx(ui.Badge, {
      muted: true,
      padding: 2,
      fontSize: 1,
      mode: "outline",
      children: "Checking..."
    });
  }
  const badgeText = isAsset ? assetMessages[status] : documentMessages[status];
  const badgeStatus = isAsset ? assetStatus[status] : status;
  return /* @__PURE__ */jsxRuntime.jsx(ui.Tooltip, {
    content: /* @__PURE__ */jsxRuntime.jsx(ui.Box, {
      padding: 3,
      style: {
        maxWidth: 200
      },
      children: /* @__PURE__ */jsxRuntime.jsx(ui.Text, {
        size: 1,
        children: badgeText
      })
    }),
    fallbackPlacements: ["right", "left"],
    placement: "top",
    portal: true,
    children: /* @__PURE__ */jsxRuntime.jsx(ui.Badge, {
      muted: true,
      padding: 2,
      fontSize: 1,
      tone: badgeTone,
      mode: "outline",
      children: badgeStatus
    })
  });
}
function Feedback(props) {
  const {
    children,
    tone = "caution"
  } = props;
  return /* @__PURE__ */jsxRuntime.jsx(ui.Card, {
    padding: 3,
    radius: 2,
    shadow: 1,
    tone,
    children: /* @__PURE__ */jsxRuntime.jsx(ui.Text, {
      size: 1,
      children
    })
  });
}
const clientConfig = {
  apiVersion: "2021-05-19"
};
function Duplicator(props) {
  var _a, _b, _c;
  const {
    docs,
    token,
    pluginConfig,
    onDuplicated
  } = props;
  const isDarkMode = ui.useTheme().sanity.color.dark;
  const originClient = sanity.useClient(clientConfig);
  const schema = sanity.useSchema();
  const workspaces = sanity.useWorkspaces();
  const workspacesOptions = workspaces.map(workspace => ({
    ...workspace,
    disabled: workspace.dataset === originClient.config().dataset
  }));
  const [destination, setDestination] = React.useState(workspaces.length ? (_a = workspacesOptions.find(space => !space.disabled)) != null ? _a : null : null);
  const [message, setMessage] = React.useState(null);
  const [payload, setPayload] = React.useState([]);
  const [hasReferences, setHasReferences] = React.useState(false);
  const [isDuplicating, setIsDuplicating] = React.useState(false);
  const [isGathering, setIsGathering] = React.useState(false);
  const [progress, setProgress] = React.useState([0, 0]);
  React.useEffect(() => {
    const expr = ".._ref";
    const initialRefs = [];
    const initialPayload = [];
    docs.forEach(doc => {
      const refs = mutator.extractWithPath(expr, doc).map(ref => ref.value);
      initialRefs.push(...refs);
      initialPayload.push({
        include: true,
        doc
      });
    });
    setPayload(initialPayload);
    const docCount = docs.length;
    const refsCount = initialRefs.length;
    if (initialRefs.length) {
      setHasReferences(true);
      setMessage({
        tone: "caution",
        text: createInitialMessage(docCount, refsCount)
      });
    }
  }, [docs]);
  React.useEffect(() => {
    updatePayloadStatuses();
  }, [destination]);
  async function updatePayloadStatuses() {
    let newPayload = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    const payloadActual = newPayload.length ? newPayload : payload;
    if (!payloadActual.length || !(destination == null ? void 0 : destination.name)) {
      return;
    }
    const payloadIds = payloadActual.map(_ref => {
      let {
        doc
      } = _ref;
      return doc._id;
    });
    const destinationClient = originClient.withConfig({
      ...clientConfig,
      dataset: destination.dataset,
      projectId: destination.projectId
    });
    const destinationData = await destinationClient.fetch("*[_id in $payloadIds]{ _id, _updatedAt }", {
      payloadIds
    });
    const updatedPayload = payloadActual.map(item => {
      var _a2;
      const existingDoc = destinationData.find(doc => doc._id === item.doc._id);
      if ((existingDoc == null ? void 0 : existingDoc._updatedAt) && ((_a2 = item == null ? void 0 : item.doc) == null ? void 0 : _a2._updatedAt)) {
        if (existingDoc._updatedAt === item.doc._updatedAt) {
          item.status = "EXISTS";
        } else if (existingDoc._updatedAt && item.doc._updatedAt) {
          item.status = new Date(existingDoc._updatedAt) > new Date(item.doc._updatedAt) ? // Document at destination is newer
          "OVERWRITE" : // Document at destination is older
          "UPDATE";
        }
      } else {
        item.status = "CREATE";
      }
      return item;
    });
    setPayload(updatedPayload);
  }
  function handleCheckbox(_id) {
    const updatedPayload = payload.map(item => {
      if (item.doc._id === _id) {
        item.include = !item.include;
      }
      return item;
    });
    setPayload(updatedPayload);
  }
  async function handleReferences() {
    setIsGathering(true);
    const docIds = docs.map(doc => doc._id);
    const payloadDocs = await getDocumentsInArray({
      fetchIds: docIds,
      client: originClient,
      pluginConfig
    });
    const draftDocs = await getDocumentsInArray({
      fetchIds: docIds.map(id => "drafts.".concat(id)),
      client: originClient,
      projection: "{_id}",
      pluginConfig
    });
    const draftDocsIds = new Set(draftDocs.map(_ref2 => {
      let {
        _id
      } = _ref2;
      return _id;
    }));
    const payloadShaped = payloadDocs.map(doc => ({
      doc,
      // Include this in the transaction?
      include: true,
      // Does it exist at the destination?
      status: void 0,
      // Does it have any drafts?
      hasDraft: draftDocsIds.has("drafts.".concat(doc._id))
    }));
    setPayload(payloadShaped);
    updatePayloadStatuses(payloadShaped);
    setIsGathering(false);
  }
  async function handleDuplicate() {
    if (!destination) {
      return;
    }
    setIsDuplicating(true);
    const assetsCount = payload.filter(_ref3 => {
      let {
        doc,
        include
      } = _ref3;
      return include && assetUtils.isAssetId(doc._id);
    }).length;
    let currentProgress = 0;
    setProgress([currentProgress, assetsCount]);
    setMessage({
      text: "Duplicating...",
      tone: "default"
    });
    const destinationClient = originClient.withConfig({
      ...clientConfig,
      dataset: destination.dataset,
      projectId: destination.projectId
    });
    const transactionDocs = [];
    const svgMaps = [];
    async function fetchDoc(doc) {
      if (assetUtils.isAssetId(doc._id)) {
        const typeIsFile = assetUtils.isSanityFileAsset(doc);
        const downloadUrl = typeIsFile ? doc.url : "".concat(doc.url, "?dlRaw=true");
        const downloadConfig = typeIsFile ? {} : {
          headers: {
            Authorization: "Bearer ".concat(token)
          }
        };
        await fetch(downloadUrl, downloadConfig).then(async res => {
          const assetData = await res.blob();
          const options = {
            filename: doc.originalFilename
          };
          const assetDoc = await destinationClient.assets.upload(typeIsFile ? "file" : "image", assetData, options);
          if ((doc == null ? void 0 : doc.extension) === "svg") {
            svgMaps.push({
              old: doc._id,
              new: assetDoc._id
            });
          }
          transactionDocs.push(assetDoc);
        });
        currentProgress += 1;
        setMessage({
          text: "Duplicating ".concat(currentProgress, "/").concat(assetsCount, " ").concat(assetsCount === 1 ? "Assets" : "Assets"),
          tone: "default"
        });
        return setProgress([currentProgress, assetsCount]);
      }
      return transactionDocs.push(doc);
    }
    const result = new Promise((resolve, reject) => {
      const payloadIncludedDocs = payload.filter(item => item.include).map(item => item.doc);
      mapLimit__default.default(payloadIncludedDocs, 3, asyncify__default.default(fetchDoc), err => {
        if (err) {
          setIsDuplicating(false);
          setMessage({
            tone: "critical",
            text: "Duplication Failed"
          });
          console.error(err);
          reject(new Error("Duplication Failed"));
        }
        resolve();
      });
    });
    await result;
    const transactionDocsMapped = transactionDocs.map(doc => {
      const expr = ".._ref";
      const references = mutator.extractWithPath(expr, doc);
      if (!references.length) {
        return doc;
      }
      references.forEach(ref => {
        var _a2;
        const newRefValue = (_a2 = svgMaps.find(asset => asset.old === ref.value)) == null ? void 0 : _a2.new;
        if (newRefValue) {
          const refPath = ref.path.join(".");
          dset.dset(doc, refPath, newRefValue);
        }
      });
      return doc;
    });
    const transaction = destinationClient.transaction();
    transactionDocsMapped.forEach(doc => {
      transaction.createOrReplace(doc);
    });
    await transaction.commit().then(res => {
      setMessage({
        tone: "positive",
        text: "Duplication complete!"
      });
      updatePayloadStatuses();
    }).catch(err => {
      setMessage({
        tone: "critical",
        text: err.details.description
      });
    });
    setIsDuplicating(false);
    setProgress([0, 0]);
    if (onDuplicated) {
      try {
        await onDuplicated();
      } catch (error) {
        setMessage({
          tone: "critical",
          text: "Error in onDuplicated hook: ".concat(error)
        });
      }
    }
  }
  function handleChange(e) {
    if (!workspacesOptions.length) {
      return;
    }
    const targeted = workspacesOptions.find(space => space.name === e.currentTarget.value);
    if (targeted) {
      setDestination(targeted);
    }
  }
  const payloadCount = payload.length;
  const firstSvgIndex = payload.findIndex(_ref4 => {
    let {
      doc
    } = _ref4;
    return doc.extension === "svg";
  });
  const selectedDocumentsCount = payload.filter(item => item.include && !assetUtils.isAssetId(item.doc._id)).length;
  const selectedAssetsCount = payload.filter(item => item.include && assetUtils.isAssetId(item.doc._id)).length;
  const selectedTotal = selectedDocumentsCount + selectedAssetsCount;
  const destinationTitle = (_b = destination == null ? void 0 : destination.title) != null ? _b : destination == null ? void 0 : destination.name;
  const hasMultipleProjectIds = new Set(workspacesOptions.map(space => space == null ? void 0 : space.projectId).filter(Boolean)).size > 1;
  const headingText = [selectedTotal, "/", payloadCount, "Documents and Assets selected"].join(" ");
  const buttonText = React__default.default.useMemo(() => {
    const text = ["Duplicate"];
    if (selectedDocumentsCount > 1) {
      text.push(String(selectedDocumentsCount), selectedDocumentsCount === 1 ? "Document" : "Documents");
    }
    if (selectedAssetsCount > 1) {
      text.push("and", String(selectedAssetsCount), selectedAssetsCount === 1 ? "Asset" : "Assets");
    }
    if (originClient.config().projectId !== (destination == null ? void 0 : destination.projectId)) {
      text.push("between Projects");
    }
    text.push("to", String(destinationTitle));
    return text.join(" ");
  }, [selectedDocumentsCount, selectedAssetsCount, originClient, destination == null ? void 0 : destination.projectId, destinationTitle]);
  if (workspacesOptions.length < 2) {
    return /* @__PURE__ */jsxRuntime.jsxs(Feedback, {
      tone: "critical",
      children: [/* @__PURE__ */jsxRuntime.jsx("code", {
        children: "sanity.config.ts"
      }), " must contain at least two Workspaces to use this plugin."]
    });
  }
  return /* @__PURE__ */jsxRuntime.jsx(ui.Container, {
    width: 1,
    children: /* @__PURE__ */jsxRuntime.jsx(ui.Card, {
      border: true,
      children: /* @__PURE__ */jsxRuntime.jsx(ui.Stack, {
        children: /* @__PURE__ */jsxRuntime.jsxs(jsxRuntime.Fragment, {
          children: [/* @__PURE__ */jsxRuntime.jsx(ui.Card, {
            borderBottom: true,
            padding: 4,
            style: stickyStyles(isDarkMode),
            children: /* @__PURE__ */jsxRuntime.jsxs(ui.Stack, {
              space: 4,
              children: [/* @__PURE__ */jsxRuntime.jsxs(ui.Flex, {
                gap: 3,
                children: [/* @__PURE__ */jsxRuntime.jsxs(ui.Stack, {
                  style: {
                    flex: 1
                  },
                  space: 3,
                  children: [/* @__PURE__ */jsxRuntime.jsx(ui.Label, {
                    children: "Duplicate from"
                  }), /* @__PURE__ */jsxRuntime.jsx(ui.Select, {
                    readOnly: true,
                    value: (_c = workspacesOptions.find(space => space.disabled)) == null ? void 0 : _c.name,
                    children: workspacesOptions.filter(space => space.disabled).map(space => {
                      var _a2;
                      return /* @__PURE__ */jsxRuntime.jsxs("option", {
                        value: space.name,
                        disabled: space.disabled,
                        children: [(_a2 = space.title) != null ? _a2 : space.name, hasMultipleProjectIds ? " (".concat(space.projectId, ")") : ""]
                      }, space.name);
                    })
                  })]
                }), /* @__PURE__ */jsxRuntime.jsx(ui.Box, {
                  padding: 4,
                  paddingTop: 5,
                  paddingBottom: 0,
                  children: /* @__PURE__ */jsxRuntime.jsx(ui.Text, {
                    size: 3,
                    children: /* @__PURE__ */jsxRuntime.jsx(icons.ArrowRightIcon, {})
                  })
                }), /* @__PURE__ */jsxRuntime.jsxs(ui.Stack, {
                  style: {
                    flex: 1
                  },
                  space: 3,
                  children: [/* @__PURE__ */jsxRuntime.jsx(ui.Label, {
                    children: "To Destination"
                  }), /* @__PURE__ */jsxRuntime.jsx(ui.Select, {
                    onChange: handleChange,
                    children: workspacesOptions.map(space => {
                      var _a2;
                      return /* @__PURE__ */jsxRuntime.jsxs("option", {
                        value: space.name,
                        disabled: space.disabled,
                        children: [(_a2 = space.title) != null ? _a2 : space.name, hasMultipleProjectIds ? " (".concat(space.projectId, ")") : "", space.disabled ? " (Current)" : ""]
                      }, space.name);
                    })
                  })]
                })]
              }), isDuplicating && /* @__PURE__ */jsxRuntime.jsx(ui.Card, {
                border: true,
                radius: 2,
                children: /* @__PURE__ */jsxRuntime.jsx(ui.Card, {
                  style: {
                    width: "100%",
                    transform: "scaleX(".concat(progress[0] / progress[1], ")"),
                    transformOrigin: "left",
                    transition: "transform .2s ease",
                    boxSizing: "border-box"
                  },
                  padding: 1,
                  tone: "positive"
                })
              }), payload.length > 0 && /* @__PURE__ */jsxRuntime.jsxs(jsxRuntime.Fragment, {
                children: [/* @__PURE__ */jsxRuntime.jsx(ui.Label, {
                  children: headingText
                }), /* @__PURE__ */jsxRuntime.jsx(SelectButtons, {
                  payload,
                  setPayload
                })]
              })]
            })
          }), message && /* @__PURE__ */jsxRuntime.jsx(ui.Box, {
            paddingX: 4,
            paddingTop: 4,
            children: /* @__PURE__ */jsxRuntime.jsx(ui.Card, {
              padding: 3,
              radius: 2,
              shadow: 1,
              tone: message.tone,
              children: /* @__PURE__ */jsxRuntime.jsx(ui.Text, {
                size: 1,
                children: message.text
              })
            })
          }), payload.length > 0 && /* @__PURE__ */jsxRuntime.jsx(ui.Stack, {
            padding: 4,
            space: 3,
            children: payload.map((_ref5, index) => {
              let {
                doc,
                include,
                status,
                hasDraft
              } = _ref5;
              const schemaType = schema.get(doc._type);
              return /* @__PURE__ */jsxRuntime.jsxs(React__default.default.Fragment, {
                children: [/* @__PURE__ */jsxRuntime.jsxs(ui.Flex, {
                  align: "center",
                  children: [/* @__PURE__ */jsxRuntime.jsx(ui.Checkbox, {
                    checked: include,
                    onChange: () => handleCheckbox(doc._id)
                  }), /* @__PURE__ */jsxRuntime.jsx(ui.Box, {
                    flex: 1,
                    paddingX: 3,
                    children: schemaType ? /* @__PURE__ */jsxRuntime.jsx(sanity.Preview, {
                      value: doc,
                      schemaType
                    }) : /* @__PURE__ */jsxRuntime.jsx(ui.Card, {
                      tone: "caution",
                      children: "Invalid schema type"
                    })
                  }), /* @__PURE__ */jsxRuntime.jsxs(ui.Flex, {
                    align: "center",
                    gap: 2,
                    children: [hasDraft ? /* @__PURE__ */jsxRuntime.jsx(StatusBadge, {
                      status: "UNPUBLISHED",
                      isAsset: false
                    }) : null, /* @__PURE__ */jsxRuntime.jsx(StatusBadge, {
                      status,
                      isAsset: assetUtils.isAssetId(doc._id)
                    })]
                  })]
                }), (doc == null ? void 0 : doc.extension) === "svg" && index === firstSvgIndex && /* @__PURE__ */jsxRuntime.jsx(ui.Card, {
                  padding: 3,
                  radius: 2,
                  shadow: 1,
                  tone: "caution",
                  children: /* @__PURE__ */jsxRuntime.jsxs(ui.Text, {
                    size: 1,
                    children: ["Due to how SVGs are sanitized after first uploaded, duplicated SVG assets may have new ", /* @__PURE__ */jsxRuntime.jsx("code", {
                      children: "_id"
                    }), "'s at the destination. The newly generated ", /* @__PURE__ */jsxRuntime.jsx("code", {
                      children: "_id"
                    }), " will be the same in each duplication, but it will never be the same ", /* @__PURE__ */jsxRuntime.jsx("code", {
                      children: "_id"
                    }), " as the first time this Asset was uploaded. References to the asset will be updated to use the new", " ", /* @__PURE__ */jsxRuntime.jsx("code", {
                      children: "_id"
                    }), "."]
                  })
                })]
              }, doc._id);
            })
          }), /* @__PURE__ */jsxRuntime.jsxs(ui.Stack, {
            space: 2,
            padding: 4,
            paddingTop: 0,
            children: [hasReferences && /* @__PURE__ */jsxRuntime.jsx(ui.Button, {
              fontSize: 2,
              padding: 4,
              tone: "positive",
              mode: "ghost",
              icon: icons.SearchIcon,
              onClick: handleReferences,
              text: "Gather References",
              disabled: isDuplicating || !selectedTotal || isGathering
            }), /* @__PURE__ */jsxRuntime.jsx(ui.Button, {
              fontSize: 2,
              padding: 4,
              tone: "positive",
              icon: icons.LaunchIcon,
              onClick: handleDuplicate,
              text: buttonText,
              disabled: isDuplicating || !selectedTotal || isGathering
            })]
          })]
        })
      })
    })
  });
}
function DuplicatorQuery(props) {
  var _a, _b;
  const {
    token,
    pluginConfig
  } = props;
  const originClient = sanity.useClient(clientConfig);
  const schema = sanity.useSchema();
  const schemaTypes = schema.getTypeNames();
  const [value, setValue] = React.useState("");
  const [initialData, setInitialData] = React.useState({
    docs: []
    // draftIds: []
  });

  function handleSubmit(e) {
    if (e) e.preventDefault();
    originClient.fetch(value).then(res => {
      const registeredAndPublishedDocs = res.length ? res.filter(doc => schemaTypes.includes(doc._type)).filter(doc => !doc._id.startsWith("drafts.")) : [];
      setInitialData({
        docs: registeredAndPublishedDocs
        // draftIds: initialDraftIds
      });
    }).catch(err => console.error(err));
  }
  React.useEffect(() => {
    var _a2;
    if (!((_a2 = initialData.docs) == null ? void 0 : _a2.length) && value) {
      handleSubmit();
    }
  }, []);
  return /* @__PURE__ */jsxRuntime.jsx(ui.Container, {
    width: [1, 1, 1, 3],
    padding: [0, 0, 0, 5],
    children: /* @__PURE__ */jsxRuntime.jsxs(ui.Grid, {
      columns: [1, 1, 1, 2],
      gap: [1, 1, 1, 4],
      children: [/* @__PURE__ */jsxRuntime.jsx(ui.Box, {
        padding: [2, 2, 2, 0],
        children: /* @__PURE__ */jsxRuntime.jsx(ui.Card, {
          padding: 4,
          radius: 3,
          border: true,
          children: /* @__PURE__ */jsxRuntime.jsxs(ui.Stack, {
            space: 4,
            children: [/* @__PURE__ */jsxRuntime.jsx(ui.Box, {
              children: /* @__PURE__ */jsxRuntime.jsx(ui.Label, {
                children: "Initial Documents Query"
              })
            }), /* @__PURE__ */jsxRuntime.jsx(ui.Box, {
              children: /* @__PURE__ */jsxRuntime.jsx(ui.Text, {
                children: "Start with a valid GROQ query to load initial documents. The query will need to return an Array of Objects. Drafts will be removed from the results."
              })
            }), /* @__PURE__ */jsxRuntime.jsx("form", {
              onSubmit: handleSubmit,
              children: /* @__PURE__ */jsxRuntime.jsxs(ui.Flex, {
                children: [/* @__PURE__ */jsxRuntime.jsx(ui.Box, {
                  flex: 1,
                  paddingRight: 2,
                  children: /* @__PURE__ */jsxRuntime.jsx(ui.TextInput, {
                    style: {
                      fontFamily: "monospace"
                    },
                    fontSize: 2,
                    onChange: event => setValue(event.currentTarget.value),
                    padding: 4,
                    placeholder: "*[_type == \"article\"]",
                    value: value != null ? value : ""
                  })
                }), /* @__PURE__ */jsxRuntime.jsx(ui.Button, {
                  padding: 2,
                  paddingX: 4,
                  tone: "primary",
                  onClick: handleSubmit,
                  text: "Query",
                  disabled: !value
                })]
              })
            })]
          })
        })
      }), !((_a = initialData.docs) == null ? void 0 : _a.length) || initialData.docs.length < 1 && /* @__PURE__ */jsxRuntime.jsx(ui.Container, {
        width: 1,
        children: /* @__PURE__ */jsxRuntime.jsx(ui.Card, {
          padding: 5,
          children: value ? "No Documents registered to the Schema match this query" : "Start with a valid GROQ query"
        })
      }), ((_b = initialData.docs) == null ? void 0 : _b.length) > 0 && /* @__PURE__ */jsxRuntime.jsx(Duplicator, {
        docs: initialData.docs,
        token,
        pluginConfig
      })]
    })
  });
}
function DuplicatorWrapper(props) {
  const {
    docs,
    token,
    pluginConfig,
    onDuplicated
  } = props;
  const [inbound, setInbound] = React.useState([]);
  const {
    follow = []
  } = pluginConfig;
  const [mode, setMode] = React.useState(follow.length === 1 ? follow[0] : "outbound");
  const client = sanity.useClient();
  React.useEffect(() => {
    (async () => {
      if (follow.includes("inbound")) {
        const inboundReferences = await client.fetch("*[references($id)]", {
          id: docs[0]._id
        });
        setInbound([...props.docs, ...inboundReferences]);
      }
    })();
  }, []);
  return /* @__PURE__ */jsxRuntime.jsxs(ui.Container, {
    children: [follow.length > 1 && (follow.includes("inbound") || follow.includes("outbound")) ? /* @__PURE__ */jsxRuntime.jsx(ui.Card, {
      paddingX: 4,
      paddingBottom: 4,
      marginBottom: 4,
      borderBottom: true,
      children: /* @__PURE__ */jsxRuntime.jsxs(ui.Grid, {
        columns: 2,
        gap: 4,
        children: [follow.includes("outbound") ? /* @__PURE__ */jsxRuntime.jsx(ui.Button, {
          mode: "ghost",
          tone: "primary",
          selected: mode === "outbound",
          onClick: () => setMode("outbound"),
          text: "Outbound"
        }) : null, follow.includes("inbound") ? /* @__PURE__ */jsxRuntime.jsx(ui.Button, {
          mode: "ghost",
          tone: "primary",
          selected: mode === "inbound",
          onClick: () => setMode("inbound"),
          disabled: inbound.length === 0,
          text: inbound.length > 0 ? "Inbound (".concat(inbound.length, ")") : "No inbound references"
        }) : null]
      })
    }) : null, /* @__PURE__ */jsxRuntime.jsx(Duplicator, {
      docs: mode === "outbound" ? docs : inbound,
      token,
      pluginConfig,
      onDuplicated
    })]
  });
}
const SECRET_NAMESPACE = "CrossDatasetDuplicator";
const DEFAULT_CONFIG = {
  tool: true,
  types: [],
  filter: "",
  follow: ["outbound"]
};
function ResetSecret() {
  const client = sanity.useClient(clientConfig);
  const handleClick = React__default.default.useCallback(() => {
    client.delete({
      query: "*[_id == \"secrets.".concat(SECRET_NAMESPACE, "\"]")
    });
  }, [client]);
  return /* @__PURE__ */jsxRuntime.jsx(ui.Flex, {
    align: "center",
    justify: "flex-end",
    paddingX: [2, 2, 2, 5],
    paddingY: 5,
    children: /* @__PURE__ */jsxRuntime.jsx(ui.Button, {
      text: "Reset Secret",
      onClick: handleClick,
      mode: "ghost",
      tone: "critical",
      fontSize: 1,
      padding: 2
    })
  });
}
const CrossDatasetDuplicatorContext = React.createContext(DEFAULT_CONFIG);
function useCrossDatasetDuplicatorConfig() {
  const pluginConfig = React.useContext(CrossDatasetDuplicatorContext);
  return pluginConfig;
}
function ConfigProvider(props) {
  const {
    pluginConfig,
    ...rest
  } = props;
  return /* @__PURE__ */jsxRuntime.jsx(CrossDatasetDuplicatorContext.Provider, {
    value: pluginConfig,
    children: props.renderDefault(rest)
  });
}
const secretConfigKeys = [{
  key: "bearerToken",
  title: "An API token with Viewer permissions is required to duplicate the original files of assets, and will be used for all Duplications. Create one at sanity.io/manage",
  description: ""
}];
function CrossDatasetDuplicator(props) {
  const {
    mode = "tool",
    docs = [],
    onDuplicated
  } = props != null ? props : {};
  const pluginConfig = useCrossDatasetDuplicatorConfig();
  const {
    loading,
    secrets
  } = studioSecrets.useSecrets(SECRET_NAMESPACE);
  const [showSecretsPrompt, setShowSecretsPrompt] = React.useState(false);
  React.useEffect(() => {
    if (secrets) {
      setShowSecretsPrompt(!(secrets == null ? void 0 : secrets.bearerToken));
    }
  }, [secrets]);
  if (loading) {
    return /* @__PURE__ */jsxRuntime.jsx(ui.Flex, {
      justify: "center",
      align: "center",
      children: /* @__PURE__ */jsxRuntime.jsx(ui.Box, {
        padding: 5,
        children: /* @__PURE__ */jsxRuntime.jsx(ui.Spinner, {})
      })
    });
  }
  if (!loading && showSecretsPrompt || !(secrets == null ? void 0 : secrets.bearerToken)) {
    return /* @__PURE__ */jsxRuntime.jsx(studioSecrets.SettingsView, {
      title: "Token Required",
      namespace: SECRET_NAMESPACE,
      keys: secretConfigKeys,
      onClose: () => setShowSecretsPrompt(false)
    });
  }
  if (mode === "tool" && pluginConfig) {
    return /* @__PURE__ */jsxRuntime.jsxs(jsxRuntime.Fragment, {
      children: [/* @__PURE__ */jsxRuntime.jsx(DuplicatorQuery, {
        token: secrets == null ? void 0 : secrets.bearerToken,
        pluginConfig
      }), /* @__PURE__ */jsxRuntime.jsx(ResetSecret, {})]
    });
  }
  if (!(docs == null ? void 0 : docs.length)) {
    return /* @__PURE__ */jsxRuntime.jsx(Feedback, {
      children: "No docs passed into Duplicator Tool"
    });
  }
  if (!pluginConfig) {
    return /* @__PURE__ */jsxRuntime.jsx(Feedback, {
      children: "No plugin config"
    });
  }
  return /* @__PURE__ */jsxRuntime.jsx(DuplicatorWrapper, {
    docs,
    token: secrets == null ? void 0 : secrets.bearerToken,
    pluginConfig,
    onDuplicated
  });
}
function CrossDatasetDuplicatorAction(props) {
  const {
    docs = [],
    onDuplicated
  } = props;
  return /* @__PURE__ */jsxRuntime.jsx(CrossDatasetDuplicator, {
    mode: "action",
    docs,
    onDuplicated
  });
}
const DuplicateToAction = props => {
  const {
    draft,
    published,
    onComplete
  } = props;
  const [dialogOpen, setDialogOpen] = React.useState(false);
  return {
    disabled: draft,
    title: draft ? "Document must be Published to begin" : null,
    label: "Duplicate to...",
    dialog: dialogOpen && published && {
      type: "modal",
      title: "Cross Dataset Duplicator",
      content: /* @__PURE__ */jsxRuntime.jsx(CrossDatasetDuplicatorAction, {
        docs: [published]
      }),
      onClose: () => {
        onComplete();
        setDialogOpen(false);
      }
    },
    onHandle: () => setDialogOpen(true),
    icon: icons.LaunchIcon
  };
};
DuplicateToAction.action = "duplicateTo";
function CrossDatasetDuplicatorTool(props) {
  var _a;
  const {
    docs = []
  } = (_a = props.tool.options) != null ? _a : {};
  return /* @__PURE__ */jsxRuntime.jsx(CrossDatasetDuplicator, {
    mode: "tool",
    docs
  });
}
const crossDatasetDuplicatorTool = () => ({
  title: "Duplicator",
  name: "duplicator",
  icon: icons.LaunchIcon,
  component: CrossDatasetDuplicatorTool,
  options: {
    docs: []
  }
});
const crossDatasetDuplicator = sanity.definePlugin(function () {
  let config = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  const pluginConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };
  const {
    types
  } = pluginConfig;
  return {
    name: "@sanity/cross-dataset-duplicator",
    tools: prev => pluginConfig.tool ? [...prev, crossDatasetDuplicatorTool()] : prev,
    studio: {
      components: {
        layout: props => ConfigProvider({
          ...props,
          pluginConfig
        })
      }
    },
    document: {
      actions: (prev, _ref6) => {
        let {
          schemaType
        } = _ref6;
        return types && types.includes(schemaType) ? [...prev, DuplicateToAction] : prev;
      }
    }
  };
});
exports.CrossDatasetDuplicatorAction = CrossDatasetDuplicatorAction;
exports.DuplicateToAction = DuplicateToAction;
exports.crossDatasetDuplicator = crossDatasetDuplicator;
exports.useCrossDatasetDuplicatorConfig = useCrossDatasetDuplicatorConfig;
//# sourceMappingURL=index.js.map
