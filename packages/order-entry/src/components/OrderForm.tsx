import { useState } from 'react';
import { 
  Search, 
  Plus, 
  User as UserIcon,
  Package,
  DollarSign,
  Save,
  Printer,
  Send,
  Trash2,
  ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// Mock customers
const mockCustomers: Customer[] = [
  { id: '1', name: 'Aldea Coffee', email: 'orders@aldeacoffee.com', phone: '555-0101', address: '123 Main St' },
  { id: '2', name: 'Downtown Diner', email: 'info@downtowndiner.com', phone: '555-0102', address: '456 Oak Ave' },
  { id: '3', name: 'Metro Fitness', email: 'contact@metrofitness.com', phone: '555-0103', address: '789 Gym Blvd' },
];

export function OrderForm() {
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [orderNumber, setOrderNumber] = useState('WO-2026-0157');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 }
  ]);

  const filteredCustomers = mockCustomers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
  };

  const handleAddLineItem = () => {
    const newId = (lineItems.length + 1).toString();
    setLineItems([...lineItems, { id: newId, description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const handleLineItemChange = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = updated.quantity * updated.unitPrice;
        }
        return updated;
      }
      return item;
    }));
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * 0.0825; // 8.25% tax
  const total = subtotal + tax;

  const handleSave = () => {
    if (!selectedCustomer) {
      toast.error('Please select a customer');
      return;
    }
    if (!lineItems.some(item => item.description && item.total > 0)) {
      toast.error('Please add at least one line item');
      return;
    }
    toast.success('Order saved successfully!');
  };

  const handleSaveAndPrint = () => {
    handleSave();
    toast.success('Sending to printer...');
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Order Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="grid grid-cols-4 gap-4">
          {/* Customer Selection */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
              Customer <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="flex">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                      if (!e.target.value) setSelectedCustomer(null);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="Search customers..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
                <button className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-r-lg">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {/* Customer Dropdown */}
              {showCustomerDropdown && customerSearch && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                  {filteredCustomers.map(customer => (
                    <div
                      key={customer.id}
                      className="px-4 py-2 hover:bg-indigo-50 cursor-pointer"
                      onClick={() => handleSelectCustomer(customer)}
                    >
                      <p className="font-medium text-gray-900">{customer.name}</p>
                      <p className="text-sm text-gray-500">{customer.email}</p>
                    </div>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <div className="px-4 py-2 text-gray-500 text-sm">No customers found</div>
                  )}
                </div>
              )}
            </div>
            
            {/* Customer Details */}
            {selectedCustomer && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                <p className="text-gray-600">{selectedCustomer.address}</p>
                <p className="text-gray-500">{selectedCustomer.phone} | {selectedCustomer.email}</p>
              </div>
            )}
          </div>

          {/* Order Info */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Order #</label>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              readOnly
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Order Date</label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">PO Number</label>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="Customer PO..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Order notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-8">#</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase w-24">Qty</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-32">Unit Price</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-32">Amount</th>
              <th className="px-4 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lineItems.map((item, index) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-500 text-sm">{index + 1}</td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                    placeholder="Enter item description..."
                    className="w-full px-2 py-1 border border-transparent hover:border-gray-300 focus:border-indigo-500 rounded"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleLineItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-center border border-transparent hover:border-gray-300 focus:border-indigo-500 rounded"
                    min="0"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => handleLineItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-right border border-transparent hover:border-gray-300 focus:border-indigo-500 rounded"
                    min="0"
                    step="0.01"
                  />
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  ${item.total.toFixed(2)}
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleRemoveLineItem(item.id)}
                    className="p-1 text-gray-400 hover:text-red-500"
                    disabled={lineItems.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <button
          onClick={handleAddLineItem}
          className="w-full px-4 py-2 text-left text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Line Item
        </button>
      </div>

      {/* Footer with Totals */}
      <div className="border-t border-gray-200 bg-gray-50 p-4">
        <div className="flex justify-between items-end">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
            >
              <Save className="w-4 h-4" />
              Save Order
            </button>
            <button
              onClick={handleSaveAndPrint}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium"
            >
              <Printer className="w-4 h-4" />
              Save & Print
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-100 rounded-lg">
              <Send className="w-4 h-4" />
              Email Quote
            </button>
          </div>

          {/* Totals */}
          <div className="text-right space-y-1">
            <div className="flex justify-between gap-8 text-sm">
              <span className="text-gray-500">Subtotal:</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-8 text-sm">
              <span className="text-gray-500">Tax (8.25%):</span>
              <span className="font-medium">${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-8 text-lg border-t border-gray-300 pt-1 mt-1">
              <span className="font-medium">Total:</span>
              <span className="font-bold text-indigo-600">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
