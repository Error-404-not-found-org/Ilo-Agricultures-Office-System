import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { cacheDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system';
import * as XLSX from 'xlsx';

export interface ReportRow {
  type: 'AI' | 'PD' | 'CD' | 'HL';
  animalId: string;
  earTag: string;
  brand: string;
  species: string;
  breed: string;
  color: string;
  address: string;
  farmer: string;
  date: string;
  noOfAi?: number;
  estrus?: string;
  sireBreed?: string;
  sireCode?: string;
  pdDate?: string;
  pdResult?: string;
  cdDate?: string;
  cdNum?: number;
  cdId?: string;
  cdSex?: string;
  cdEase?: string;
}

export const generatePDF = async (data: ReportRow[], month: string, year: string) => {
  const tableRows = data.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${row.animalId}</td>
      <td>${row.earTag}</td>
      <td>${row.brand}</td>
      <td>${row.species}</td>
      <td>${row.breed}</td>
      <td>${row.color}</td>
      <td>${row.address}</td>
      <td>${row.farmer}</td>
      <td>${row.date}</td>
      <td>${row.noOfAi || ''}</td>
      <td>${row.estrus || ''}</td>
      <td>${row.sireBreed || ''}</td>
      <td>${row.sireCode || ''}</td>
      <td>${row.pdDate || ''}</td>
      <td>${row.pdResult || ''}</td>
      <td>${row.cdDate || ''}</td>
      <td>${row.cdNum || ''}</td>
      <td>${row.cdId || ''}</td>
      <td>${row.cdSex || ''}</td>
      <td>${row.cdEase || ''}</td>
    </tr>
  `).join('');

  const html = `
    <html>
      <head>
        <style>
          body { font-family: 'Arial', sans-serif; font-size: 10px; margin: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .title { font-weight: bold; font-size: 14px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid black; padding: 4px; text-align: center; }
          th { background-color: #f2f2f2; font-size: 8px; }
          .form-info { display: flex; justify-content: space-between; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="font-size: 8px; text-align: left;">UNIP Form No.2 (Revised)</div>
          <div class="title">Unified National Artificial Insemination Program</div>
          <div>Monthly Accomplish Report</div>
          <div style="margin-top: 5px;">For the Month of <b>${month}</b>, <b>${year}</b></div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th rowspan="2">No.</th>
              <th colspan="7">Animal Identification</th>
              <th rowspan="2">Farmer</th>
              <th colspan="5">Artificial Insemination</th>
              <th colspan="2">Pregnancy Diagnosis</th>
              <th colspan="5">Calf Drop</th>
            </tr>
            <tr>
              <th>ID No.</th>
              <th>Ear Tag</th>
              <th>Brand</th>
              <th>Species</th>
              <th>Breed</th>
              <th>Color</th>
              <th>Address</th>
              <th>Date</th>
              <th>No. of AI</th>
              <th>Estrus</th>
              <th>Sire Breed</th>
              <th>Sire Code</th>
              <th>Date</th>
              <th>Result</th>
              <th>Date</th>
              <th>No.</th>
              <th>Calf ID</th>
              <th>Sex</th>
              <th>Ease</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri);
};

export const generateExcel = async (data: ReportRow[], filename: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  
  const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const uri = `${cacheDirectory}${filename}.xlsx`;
  
  await writeAsStringAsync(uri, wbout, {
    encoding: EncodingType.Base64
  });
  
  await Sharing.shareAsync(uri);
};
