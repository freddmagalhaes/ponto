import jsPDF from 'jspdf';
import { afdTimestamp, digits } from './afd';
import { savePdf } from './download';

export interface ReceiptData {
  nsr: number;
  employer: { name: string; cnpj: string; location: string };
  employee: { name: string; cpf: string };
  punchedAt: string;
  inpiRegistration: string;
  hash: string;
  kind: string;
}

export const KIND_LABELS: Record<string, string> = {
  entrada: 'Entrada', almoco_saida: 'Saída para almoço', almoco_retorno: 'Retorno do almoço', saida: 'Saída',
};

export const formatCpf = (v: string) => digits(v).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
export const formatCnpj = (v: string) => digits(v).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

/** Comprovante com o conteúdo do art. 79 da Portaria 671/2021 (itens I a VIII). A assinatura (item IX) não é gerada aqui. */
export function savePunchReceipt(d: ReceiptData) {
  const doc = new jsPDF();
  const when = afdTimestamp(d.punchedAt);
  const [date, time] = [when.slice(0, 10).split('-').reverse().join('/'), when.slice(11, 16)];
  doc.setFontSize(16);
  doc.text('Comprovante de Registro de Ponto do Trabalhador', 14, 20);
  doc.setFontSize(11);
  const rows: [string, string][] = [
    ['NSR', String(d.nsr).padStart(9, '0')],
    ['Empregador', d.employer.name],
    ['CNPJ/CPF', formatCnpj(d.employer.cnpj)],
    ['Local da prestação do serviço', d.employer.location || '-'],
    ['Trabalhador', d.employee.name],
    ['CPF', formatCpf(d.employee.cpf)],
    ['Marcação', `${KIND_LABELS[d.kind] ?? d.kind}`],
    ['Data e horário', `${date} às ${time}`],
    ['Registro do programa no INPI', d.inpiRegistration || 'não informado'],
  ];
  let y = 34;
  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'bold'); doc.text(`${label}:`, 14, y);
    doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(value, 120), 78, y);
    y += 9;
  }
  doc.setFont('helvetica', 'bold'); doc.text('Código hash (SHA-256):', 14, y);
  doc.setFont('courier', 'normal'); doc.setFontSize(9);
  doc.text(doc.splitTextToSize(d.hash, 180), 14, y + 7);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8);
  doc.text('Documento sem assinatura eletrônica qualificada (PAdES/ICP-Brasil).', 14, 280);
  savePdf(doc, `comprovante_ponto_NSR_${String(d.nsr).padStart(9, '0')}.pdf`);
}
