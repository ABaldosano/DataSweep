import { formatCurrency } from "../utils/data";
import "./TopBranchesTable.css";

export default function TopBranchesTable({ data }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="branches-table-wrap">
      <table className="branches-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Branch</th>
            <th>City</th>
            <th>Orders</th>
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {data.map((b, i) => (
            <tr key={`${b.branch}-${b.city}`}>
              <td className="rank">{i + 1}</td>
              <td>{b.branch}</td>
              <td className="dim">{b.city}</td>
              <td className="dim">{b.orders}</td>
              <td>
                <div className="revenue-bar-wrap">
                  <span className="revenue-figure">{formatCurrency(b.revenue)}</span>
                  <div
                    className="revenue-bar"
                    style={{ width: `${(b.revenue / max) * 100}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
