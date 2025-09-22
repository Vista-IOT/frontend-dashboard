"use client";

import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";

// Configuration interface for CSV columns
export interface CSVColumnConfig<T> {
  key: keyof T;
  header: string;
  defaultValue?: any;
  required?: boolean;
  transform?: (value: string) => any;
}

// Props interface for the CSV component
interface CSVImportExportProps<T> {
  data: T[];
  filename: string;
  columns: CSVColumnConfig<T>[];
  onImport: (importedData: T[]) => void;
  validateRow?: (row: T, index: number) => string[];
  disabled?: boolean;
  className?: string;
  generateId?: () => string;
}

export function CSVImportExport<T>({
  data,
  filename,
  columns,
  onImport,
  validateRow,
  disabled = false,
  className = "",
  generateId = () => `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}: CSVImportExportProps<T>) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV Export Function
  const handleExportCSV = () => {
    if (data.length === 0) {
      toast.error("No data to export", { duration: 3000 });
      return;
    }

    const csvHeaders = columns.map(col => col.header);
    
    const csvData = data.map((item: T) => 
      columns.map(col => {
        const value = item[col.key];
        return value !== undefined && value !== null ? String(value) : (col.defaultValue || "");
      })
    );

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => 
        typeof field === 'string' && (field.includes(',') || field.includes('"') || field.includes('\n'))
          ? `"${field.replace(/"/g, '""')}"` 
          : field
      ).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    toast.success(`Exported ${data.length} items to CSV`, { duration: 3000 });
  };

  // CSV Import Function
  const handleImportCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast.error("Failed to read file", { duration: 3000 });
        return;
      }

      try {
        const parseCSV = (text: string): string[][] => {
          const rows: string[][] = [];
          const lines = text.split(/\r?\n/);
          
          if (lines.length === 0) return rows;
          
          // Auto-detect delimiter
          const firstLine = lines[0];
          const tabCount = (firstLine.match(/\t/g) || []).length;
          const commaCount = (firstLine.match(/,/g) || []).length;
          const delimiter = (tabCount > commaCount || (tabCount > 0 && commaCount === 0)) ? '\t' : ',';
          
          for (const line of lines) {
            if (!line.trim()) continue;
            
            if (delimiter === '\t') {
              const row = line.split('\t').map(cell => cell.trim());
              if (row.some(cell => cell.length > 0)) {
                rows.push(row);
              }
            } else {
              // CSV parsing with quote handling
              const row: string[] = [];
              let current = '';
              let inQuotes = false;
              
              for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];
                
                if (char === '"' && !inQuotes) {
                  inQuotes = true;
                } else if (char === '"' && inQuotes && nextChar === '"') {
                  current += '"';
                  i++; // Skip next quote
                } else if (char === '"' && inQuotes) {
                  inQuotes = false;
                } else if (char === ',' && !inQuotes) {
                  row.push(current.trim());
                  current = '';
                } else {
                  current += char;
                }
              }
              
              row.push(current.trim());
              if (row.some(cell => cell.length > 0)) {
                rows.push(row);
              }
            }
          }
          
          return rows;
        };

        const rows = parseCSV(text);
        
        if (rows.length < 2) {
          toast.error("CSV file must have at least a header and one data row", { duration: 3000 });
          return;
        }

        const headers = rows[0].map(h => h.replace(/^"|"$/g, '').toLowerCase().replace(/\s+/g, ''));
        const dataRows = rows.slice(1);

        const newItems: T[] = [];
        const importErrors: string[] = [];

        // Create a mapping from CSV headers to column keys
        const headerToColumnMap = new Map<string, CSVColumnConfig<T>>();
        columns.forEach(col => {
          const normalizedHeader = col.header.toLowerCase().replace(/\s+/g, '');
          headerToColumnMap.set(normalizedHeader, col);
        });

        dataRows.forEach((values, index) => {
          // Ensure the row has enough columns, pad with empty strings if needed
          while (values.length < headers.length) {
            values.push('');
          }
          
          // If row has more columns than headers, truncate
          if (values.length > headers.length) {
            values = values.slice(0, headers.length);
          }

          const itemData: any = { id: generateId() };
          
          // Map CSV values to object properties
          headers.forEach((header, i) => {
            const column = headerToColumnMap.get(header);
            if (column) {
              let value = values[i] ? values[i].replace(/^"|"$/g, '') : '';
              
              // Apply transformation if provided
              if (column.transform && value !== '') {
                try {
                  value = column.transform(value);
                } catch (error) {
                  // If transformation fails, use default or empty
                  value = column.defaultValue !== undefined ? column.defaultValue : '';
                }
              } else if (value === '' && column.defaultValue !== undefined) {
                value = column.defaultValue;
              }
              
              itemData[column.key] = value;
            }
          });

          // Set default values for missing columns
          columns.forEach(col => {
            if (itemData[col.key] === undefined) {
              itemData[col.key] = col.defaultValue !== undefined ? col.defaultValue : '';
            }
          });

          // Basic validation
          const rowErrors: string[] = [];
          columns.forEach(col => {
            if (col.required && (!itemData[col.key] || String(itemData[col.key]).trim() === '')) {
              rowErrors.push(`${col.header} is required`);
            }
          });

          // Custom validation if provided
          if (validateRow) {
            const customErrors = validateRow(itemData as T, index);
            rowErrors.push(...customErrors);
          }

          if (rowErrors.length > 0) {
            importErrors.push(`Row ${index + 2}: ${rowErrors.join(', ')}`);
          } else {
            newItems.push(itemData as T);
          }
        });

        if (importErrors.length > 0 && newItems.length === 0) {
          toast.error(`Import failed with ${importErrors.length} errors: ${importErrors.slice(0, 3).join('; ')}${importErrors.length > 3 ? '...' : ''}`, { duration: 5000 });
          return;
        }

        if (newItems.length === 0) {
          toast.error("No valid items found in CSV file", { duration: 3000 });
          return;
        }

        // Show warning if there were errors but some items were imported
        if (importErrors.length > 0) {
          toast.warning(`Imported ${newItems.length} items with ${importErrors.length} errors. First few errors: ${importErrors.slice(0, 2).join('; ')}`, { duration: 5000 });
        } else {
          toast.success(`Successfully imported ${newItems.length} items from CSV`, { duration: 3000 });
        }

        onImport(newItems);

      } catch (error) {
        console.error('CSV parsing error:', error);
        toast.error("Failed to parse CSV file. Please check the file format.", { duration: 3000 });
      }
    };

    reader.readAsText(file);
  };

  // File input handler
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv') && !file.name.endsWith('.tsv') && !file.name.endsWith('.txt')) {
        toast.error("Please select a CSV, TSV, or TXT file", { duration: 3000 });
        return;
      }
      handleImportCSV(file);
    }
    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  return (
    <div className={`flex space-x-2 ${className}`}>
      <Button
        variant="outline"
        onClick={handleExportCSV}
        disabled={disabled || data.length === 0}
        className="bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700"
      >
        <FileSpreadsheet className="h-4 w-4 mr-2" /> Export CSV
      </Button>
      
      <input
        type="file"
        ref={fileInputRef}
        accept=".csv,.tsv,.txt,.xlsx,.xls"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      
      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700"
      >
        <FileSpreadsheet className="h-4 w-4 mr-2" /> Import CSV
      </Button>
    </div>
  );
}
