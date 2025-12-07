var highlightRegExp = /highlight-(?:(?:text|source)-)?([a-z0-9]+)/;
function highlightedCodeBlock(turndownService) {
  turndownService.addRule("highlightedCodeBlock", {
    filter: function(node) {
      var firstChild = node.firstChild;
      return node.nodeName === "DIV" && highlightRegExp.test(node.className) && firstChild && firstChild.nodeName === "PRE";
    },
    replacement: function(content, node, options) {
      var className = node.className || "";
      var language = (className.match(highlightRegExp) || [null, ""])[1];
      return "\n\n" + options.fence + language + "\n" + node.firstChild.textContent + "\n" + options.fence + "\n\n";
    }
  });
}
function strikethrough(turndownService) {
  turndownService.addRule("strikethrough", {
    filter: ["del", "s", "strike"],
    replacement: function(content) {
      return "~~" + content + "~~";
    }
  });
}
var rules = {};
function cleanCellContent(content) {
  if (!content) return "   ";
  let cleaned = content.trim().replace(/\s+/g, " ").replace(/\|/g, "\\|").replace(/\\/g, "\\\\").replace(/\n+/g, " ").replace(/\r+/g, " ");
  if (!cleaned || cleaned.match(/^\s*$/)) {
    return "   ";
  }
  if (cleaned.length < 3) {
    cleaned += " ".repeat(3 - cleaned.length);
  }
  return cleaned;
}
function cell(content, node, index) {
  if (index === null && node && node.parentNode) {
    index = Array.prototype.indexOf.call(node.parentNode.childNodes, node);
  }
  if (index === null) index = 0;
  var prefix = " ";
  if (index === 0) prefix = "| ";
  let cellContent = cleanCellContent(content);
  let colspan = 1;
  if (node && node.getAttribute) {
    colspan = parseInt(node.getAttribute("colspan") || "1", 10);
    if (isNaN(colspan) || colspan < 1) colspan = 1;
  }
  let result = prefix + cellContent + " |";
  for (let i = 1; i < colspan; i++) {
    result += "   |";
  }
  return result;
}
function isHeadingRow(tr) {
  if (!tr || !tr.parentNode) return false;
  var parentNode = tr.parentNode;
  if (parentNode.nodeName === "THEAD") return true;
  if (parentNode.firstChild === tr && (parentNode.nodeName === "TABLE" || parentNode.nodeName === "TBODY")) {
    var cellNodes = Array.prototype.filter.call(tr.childNodes, function(n) {
      return n.nodeType === 1;
    });
    if (cellNodes.length === 0) return false;
    return Array.prototype.every.call(cellNodes, function(n) {
      return n.nodeName === "TH";
    });
  }
  return false;
}
function getTableColCount(table) {
  if (!table || !table.rows) return 0;
  let maxCols = 0;
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    if (!row || !row.childNodes) continue;
    let colCount = 0;
    for (let j = 0; j < row.childNodes.length; j++) {
      const cell2 = row.childNodes[j];
      if (cell2.nodeType === 1 && (cell2.nodeName === "TD" || cell2.nodeName === "TH")) {
        const colspan = parseInt(cell2.getAttribute("colspan") || "1", 10);
        colCount += isNaN(colspan) ? 1 : Math.max(1, colspan);
      }
    }
    if (colCount > maxCols) maxCols = colCount;
  }
  return maxCols;
}
function shouldSkipTable(table) {
  if (!table) return true;
  if (!table.rows || table.rows.length === 0) return true;
  let contentCells = 0;
  let totalCells = 0;
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    if (!row || !row.childNodes) continue;
    for (let j = 0; j < row.childNodes.length; j++) {
      const cell2 = row.childNodes[j];
      if (cell2.nodeType === 1 && (cell2.nodeName === "TD" || cell2.nodeName === "TH")) {
        totalCells++;
        if (cell2.textContent && cell2.textContent.trim()) {
          contentCells++;
        }
      }
    }
  }
  if (totalCells === 0) return true;
  if (totalCells === 1 && contentCells === 0) return true;
  return false;
}
rules.tableCell = {
  filter: ["th", "td"],
  replacement: function(content, node) {
    return cell(content, node, null);
  }
};
rules.tableRow = {
  filter: "tr",
  replacement: function(content, node) {
    if (!content || !content.trim()) return "";
    var borderCells = "";
    if (isHeadingRow(node)) {
      const table = node.closest("table");
      if (table) {
        const colCount = getTableColCount(table);
        if (colCount > 0) {
          for (var i = 0; i < colCount; i++) {
            const prefix = i === 0 ? "| " : " ";
            borderCells += prefix + "--- |";
          }
        }
      }
    }
    return "\n" + content + (borderCells ? "\n" + borderCells : "");
  }
};
rules.table = {
  filter: "table",
  replacement: function(content, node) {
    if (shouldSkipTable(node)) {
      return "";
    }
    content = content.replace(/\n+/g, "\n").trim();
    if (!content) return "";
    const lines = content.split("\n").filter((line) => line.trim());
    if (lines.length === 0) return "";
    const hasHeaderSeparator = lines.length >= 2 && /\|\s*-+/.test(lines[1]);
    let result = lines.join("\n");
    if (!hasHeaderSeparator && lines.length >= 1) {
      const firstLine = lines[0];
      const colCount = (firstLine.match(/\|/g) || []).length - 1;
      if (colCount > 0) {
        let separator = "|";
        for (let i = 0; i < colCount; i++) {
          separator += " --- |";
        }
        const resultLines = [lines[0], separator, ...lines.slice(1)];
        result = resultLines.join("\n");
      }
    }
    return "\n\n" + result + "\n\n";
  }
};
rules.tableSection = {
  filter: ["thead", "tbody", "tfoot"],
  replacement: function(content) {
    return content;
  }
};
rules.tableCaption = {
  filter: ["caption"],
  replacement: function() {
    return "";
  }
};
rules.tableColgroup = {
  filter: ["colgroup", "col"],
  replacement: function() {
    return "";
  }
};
function tables(turndownService) {
  for (var key in rules) {
    turndownService.addRule(key, rules[key]);
  }
}
function taskListItems(turndownService) {
  turndownService.addRule("taskListItems", {
    filter: function(node) {
      return node.type === "checkbox" && node.parentNode.nodeName === "LI";
    },
    replacement: function(content, node) {
      return (node.checked ? "[x]" : "[ ]") + " ";
    }
  });
}
function gfm(turndownService) {
  turndownService.use([
    highlightedCodeBlock,
    strikethrough,
    tables,
    taskListItems
  ]);
}
export {
  gfm as default,
  gfm,
  highlightedCodeBlock,
  strikethrough,
  tables,
  taskListItems
};
//# sourceMappingURL=index.js.map
