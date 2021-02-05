import React from "../_snowpack/pkg/react.js";
import ReactDOM from "../_snowpack/pkg/react-dom.js";
import {css} from "../_snowpack/pkg/@emotion/css.js";
import SlateEditor from "./components/SlateEditor/index.js";
import ConnectionForm from "./components/ConnectionForm.js";
const pageStyle = css`
  margin: 24px;
`;
const App = () => /* @__PURE__ */ React.createElement("div", {
  className: pageStyle
}, /* @__PURE__ */ React.createElement(ConnectionForm, null), /* @__PURE__ */ React.createElement(SlateEditor, null));
ReactDOM.render(/* @__PURE__ */ React.createElement(App, null), document.getElementById("root"));
