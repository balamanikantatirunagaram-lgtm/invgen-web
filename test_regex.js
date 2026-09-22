const html = `
<tbody>
  {{#each inv.items}}
  <tr>
    <td>{{index}}</td>
    <td>{{name}}</td>
    <td>{{qty}}</td>
    <td>{{rate}}</td>
    <td>{{total}}</td>
  </tr>
  {{/each}}
</tbody>
`;

const items = [
  { name: 'Web Dev', qty: 1, rate: 25000, total: 25000 },
  { name: 'Design', qty: 2, rate: 5000, total: 10000 }
];

let res = html.replace(/\{\{#each inv\.items\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, content) => {
  return items.map((item, idx) => {
    let row = content;
    row = row.replace(/\{\{index\}\}/g, idx + 1);
    row = row.replace(/\{\{name\}\}/g, item.name);
    row = row.replace(/\{\{qty\}\}/g, item.qty);
    row = row.replace(/\{\{rate\}\}/g, item.rate);
    row = row.replace(/\{\{total\}\}/g, item.total);
    return row;
  }).join('');
});

console.log(res);
