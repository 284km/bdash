import electron from "electron";
import markdownTable from "markdown-table";
import csvStringify from "csv-stringify";
import GitHubApiClient from "./GitHubApiClient";
import Chart from "./Chart";
import DataSource from "./DataSource";
import Util from "./Util";

export default {
  async shareOnGist({ query, chart, setting, dataSource }) {
    const [tsv, svg] = await Promise.all([getTableDataAsTsv(query), getChartAsSvg(query, chart)]);

    const description = query.title;
    const queryDescription = Util.stripHeredoc(`
      ## Data source
      |key|value|
      |---|---|
      |type|${dataSource.type}
      ${DataSource.create(dataSource).descriptionTable()}
    `);
    const files = {
      "00_bdash.sql": { content: query.body },
      "01_table.tsv": { content: tsv },
      "03_info.md": { content: queryDescription }
    };

    if (svg) {
      files["02_chart.svg"] = { content: svg };
    }

    const client = new GitHubApiClient(setting);
    const result = await client.postToGist({ description, files });

    electron.shell.openExternal(result.html_url);
  },

  copyAsMarkdown(query) {
    const markdown = markdownTable(getTableData(query));
    electron.clipboard.writeText(markdown);
  },

  async copyAsTsv(query) {
    const tsv = await getTableDataAsTsv(query);
    return electron.clipboard.writeText(tsv);
  },

  async copyAsCsv(query) {
    const csv = await getTableDataAsCsv(query);
    return electron.clipboard.writeText(csv);
  }
};

// private functions
function getTableData(query) {
  const rows = query.rows.map(row => Object.values(row));
  return [query.fields].concat(rows);
}

function getTableDataAsTsv(query): Promise<string> {
  return new Promise((resolve, reject) => {
    csvStringify(getTableData(query), { delimiter: "\t" }, (err, tsv) => {
      if (err) {
        reject(err);
      } else {
        resolve(tsv);
      }
    });
  });
}

function getTableDataAsCsv(query): Promise<string> {
  return new Promise((resolve, reject) => {
    const csvOpts = {
      eof: true,
      quote: '"',
      quoted: true,
      quotedEmpty: true,
      quotedString: true,
      escape: '"',
      columns: query.fields,
      header: true
    };
    const data = query.rows.map(row => Object.values(row));
    // @ts-ignore
    csvStringify(data, csvOpts, (err, csv) => {
      if (err) {
        reject(err);
      } else {
        resolve(csv);
      }
    });
  });
}

function getChartAsSvg(query, chart) {
  if (!query || !chart) return Promise.resolve(null);

  const params = {
    type: chart.type,
    x: chart.xColumn,
    y: chart.yColumns,
    stacking: chart.stacking,
    groupBy: chart.groupColumn,
    rows: query.rows,
    fields: query.fields
  };

  return new Chart(params).toSVG();
}
