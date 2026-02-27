import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow
} from "@fluentui/react-components";

import { EmptyState } from "./EmptyState";

export type EntityTableColumn<Row> = {
  id: string;
  header: string;
  renderCell: (row: Row) => ReactNode;
};

type EntityTableProps<Row> = {
  columns: Array<EntityTableColumn<Row>>;
  rows: Row[];
  getRowId: (row: Row, index: number) => string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function EntityTable<Row>({
  columns,
  rows,
  getRowId,
  emptyTitle = "No records yet",
  emptyDescription = "Add or import data to populate this table."
}: EntityTableProps<Row>) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Table aria-label="Entity table">
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHeaderCell key={column.id}>{column.header}</TableHeaderCell>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={getRowId(row, index)}>
            {columns.map((column) => (
              <TableCell key={column.id}>{column.renderCell(row)}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
