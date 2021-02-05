import React, {useCallback, useMemo, useState, useEffect} from "../../../_snowpack/pkg/react.js";
import isHotkey from "../../../_snowpack/pkg/is-hotkey.js";
import {Editable, withReact, useSlate, Slate} from "../../../_snowpack/pkg/slate-react.js";
import {
  Editor,
  Transforms,
  createEditor,
  Element as SlateElement
} from "../../../_snowpack/pkg/slate.js";
import {withHistory} from "../../../_snowpack/pkg/slate-history.js";
import * as Y from "../../../_snowpack/pkg/yjs.js";
import {withYjs, toSharedType} from "../../../_snowpack/pkg/slate-yjs.js";
import randomColor from "../../../_snowpack/pkg/randomcolor.js";
import {WebsocketProvider} from "../../services/y-websocket.js";
import {cx, css} from "../../../_snowpack/pkg/@emotion/css.js";
import {Button, Icon, Toolbar} from "./components.js";
import {YJS_ENDPOINT} from "../../services/state.js";
import useCursor from "../../services/useCursor.js";
import useLocalStorage from "../../services/useLocalStorage.js";
const HOTKEYS = {
  "mod+b": "bold",
  "mod+i": "italic",
  "mod+u": "underline",
  "mod+`": "code"
};
const LIST_TYPES = ["numbered-list", "bulleted-list"];
const SlateEditor = () => {
  const [value, setValue] = useState([]);
  const [editable, setEditable] = useState(false);
  const [storedValue] = useLocalStorage("document", `doc-${Math.round(Math.random() * 1e4)}-fallback`);
  const [sharedType, provider] = useMemo(() => {
    const doc = new Y.Doc();
    const sharedType2 = doc.getArray("content");
    const provider2 = new WebsocketProvider(YJS_ENDPOINT, `?doc=${storedValue}`, doc);
    return [sharedType2, provider2];
  }, []);
  const editor = useMemo(() => {
    const editor2 = withYjs(withReact(withHistory(createEditor())), sharedType);
    return editor2;
  }, []);
  const color = useMemo(() => randomColor({
    luminosity: "dark",
    format: "rgba",
    alpha: 1
  }), []);
  const cursorOptions = {
    name: `User ${Math.round(Math.random() * 1e3)}`,
    color,
    alphaColor: color.slice(0, -2) + "0.2)"
  };
  const {decorate} = useCursor(editor, provider.awareness, cursorOptions);
  const renderElement = useCallback((props) => /* @__PURE__ */ React.createElement(Element, {
    ...props
  }), []);
  const renderLeaf = useCallback((props) => /* @__PURE__ */ React.createElement(Leaf, {
    ...props
  }), [decorate]);
  useEffect(() => {
    provider.on("status", ({status}) => {
      setEditable(true);
    });
    provider.on("sync", (isSynced) => {
      if (isSynced && sharedType.length === 0) {
        toSharedType(sharedType, [
          {type: "paragraph", children: [{text: ""}]}
        ]);
      }
    });
    return () => {
      provider.disconnect();
    };
  }, []);
  return /* @__PURE__ */ React.createElement(ExampleContent, null, /* @__PURE__ */ React.createElement(Slate, {
    editor,
    value,
    onChange: (value2) => setValue(value2)
  }, /* @__PURE__ */ React.createElement(Toolbar, null, /* @__PURE__ */ React.createElement(MarkButton, {
    format: "bold",
    icon: "format_bold"
  }), /* @__PURE__ */ React.createElement(MarkButton, {
    format: "italic",
    icon: "format_italic"
  }), /* @__PURE__ */ React.createElement(MarkButton, {
    format: "underline",
    icon: "format_underlined"
  }), /* @__PURE__ */ React.createElement(MarkButton, {
    format: "code",
    icon: "code"
  }), /* @__PURE__ */ React.createElement(BlockButton, {
    format: "heading-one",
    icon: "looks_one"
  }), /* @__PURE__ */ React.createElement(BlockButton, {
    format: "heading-two",
    icon: "looks_two"
  }), /* @__PURE__ */ React.createElement(BlockButton, {
    format: "block-quote",
    icon: "format_quote"
  }), /* @__PURE__ */ React.createElement(BlockButton, {
    format: "numbered-list",
    icon: "format_list_numbered"
  }), /* @__PURE__ */ React.createElement(BlockButton, {
    format: "bulleted-list",
    icon: "format_list_bulleted"
  })), !editable && /* @__PURE__ */ React.createElement("div", null, "Loading..."), editable && /* @__PURE__ */ React.createElement(Editable, {
    renderElement,
    renderLeaf,
    decorate,
    placeholder: "Enter some rich text\u2026",
    spellCheck: true,
    onKeyDown: (event) => {
      for (const hotkey in HOTKEYS) {
        if (isHotkey(hotkey, event)) {
          event.preventDefault();
          const mark = HOTKEYS[hotkey];
          toggleMark(editor, mark);
        }
      }
    }
  })));
};
const toggleBlock = (editor, format) => {
  const isActive = isBlockActive(editor, format);
  const isList = LIST_TYPES.includes(format);
  Transforms.unwrapNodes(editor, {
    match: (n) => LIST_TYPES.includes(!Editor.isEditor(n) && SlateElement.isElement(n) && n.type),
    split: true
  });
  const newProperties = {
    type: isActive ? "paragraph" : isList ? "list-item" : format
  };
  Transforms.setNodes(editor, newProperties);
  if (!isActive && isList) {
    const block = {type: format, children: []};
    Transforms.wrapNodes(editor, block);
  }
};
const toggleMark = (editor, format) => {
  const isActive = isMarkActive(editor, format);
  if (isActive) {
    Editor.removeMark(editor, format);
  } else {
    Editor.addMark(editor, format, true);
  }
};
const isBlockActive = (editor, format) => {
  const [match] = Editor.nodes(editor, {
    match: (n) => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === format
  });
  return !!match;
};
const isMarkActive = (editor, format) => {
  const marks = Editor.marks(editor);
  return marks ? marks[format] === true : false;
};
const Element = ({attributes, children, element}) => {
  switch (element.type) {
    case "block-quote":
      return /* @__PURE__ */ React.createElement("blockquote", {
        ...attributes
      }, children);
    case "bulleted-list":
      return /* @__PURE__ */ React.createElement("ul", {
        ...attributes
      }, children);
    case "heading-one":
      return /* @__PURE__ */ React.createElement("h1", {
        ...attributes
      }, children);
    case "heading-two":
      return /* @__PURE__ */ React.createElement("h2", {
        ...attributes
      }, children);
    case "list-item":
      return /* @__PURE__ */ React.createElement("li", {
        ...attributes
      }, children);
    case "numbered-list":
      return /* @__PURE__ */ React.createElement("ol", {
        ...attributes
      }, children);
    default:
      return /* @__PURE__ */ React.createElement("p", {
        ...attributes
      }, children);
  }
};
const Leaf = ({attributes, children, leaf}) => {
  if (leaf.bold) {
    children = /* @__PURE__ */ React.createElement("strong", null, children);
  }
  if (leaf.code) {
    children = /* @__PURE__ */ React.createElement("code", null, children);
  }
  if (leaf.italic) {
    children = /* @__PURE__ */ React.createElement("em", null, children);
  }
  if (leaf.underline) {
    children = /* @__PURE__ */ React.createElement("u", null, children);
  }
  return /* @__PURE__ */ React.createElement("span", {
    ...attributes,
    style: {
      position: "relative",
      backgroundColor: leaf.alphaColor
    }
  }, leaf.isCaret ? /* @__PURE__ */ React.createElement(Caret, {
    ...leaf
  }) : null, children);
};
const BlockButton = ({format, icon}) => {
  const editor = useSlate();
  return /* @__PURE__ */ React.createElement(Button, {
    active: isBlockActive(editor, format),
    onMouseDown: (event) => {
      event.preventDefault();
      toggleBlock(editor, format);
    }
  }, /* @__PURE__ */ React.createElement(Icon, null, icon));
};
const MarkButton = ({format, icon}) => {
  const editor = useSlate();
  return /* @__PURE__ */ React.createElement(Button, {
    active: isMarkActive(editor, format),
    onMouseDown: (event) => {
      event.preventDefault();
      toggleMark(editor, format);
    }
  }, /* @__PURE__ */ React.createElement(Icon, null, icon));
};
const Wrapper = ({className, ...props}) => /* @__PURE__ */ React.createElement("div", {
  ...props,
  className: cx(className, css`
        margin: 20px auto;
        padding: 20px;
      `)
});
const ExampleContent = (props) => /* @__PURE__ */ React.createElement(Wrapper, {
  ...props,
  className: css`
      background: #fff;
    `
});
const Caret = ({color, isForward, name}) => {
  const cursorStyles = {
    ...cursorStyleBase,
    background: color,
    left: isForward ? "100%" : "0%"
  };
  const caretStyles = {
    ...caretStyleBase,
    background: color,
    left: isForward ? "100%" : "0%"
  };
  caretStyles[isForward ? "bottom" : "top"] = 0;
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", {
    contentEditable: false,
    style: caretStyles
  }, /* @__PURE__ */ React.createElement("span", {
    style: {position: "relative"}
  }, /* @__PURE__ */ React.createElement("span", {
    contentEditable: false,
    style: cursorStyles
  }, name))));
};
const cursorStyleBase = {
  position: "absolute",
  top: -2,
  pointerEvents: "none",
  userSelect: "none",
  transform: "translateY(-100%)",
  fontSize: 10,
  color: "white",
  background: "palevioletred",
  whiteSpace: "nowrap"
};
const caretStyleBase = {
  position: "absolute",
  pointerEvents: "none",
  userSelect: "none",
  height: "1.2em",
  width: 2,
  background: "palevioletred"
};
export default SlateEditor;
