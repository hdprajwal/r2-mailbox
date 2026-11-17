import { visit, SKIP } from 'unist-util-visit';

// Wide reference tables scroll sideways on small screens instead of
// squeezing the page.
export default function rehypeWrapTables() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'table' || !parent || index === undefined) return;
      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-wrap'] },
        children: [node],
      };
      return SKIP;
    });
  };
}
