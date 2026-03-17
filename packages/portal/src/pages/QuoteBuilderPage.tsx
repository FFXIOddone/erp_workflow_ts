import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator,
  ArrowLeft,
  ArrowRight,
  Package,
  Ruler,
  Hash,
  Plus,
  Trash2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  Sparkles,
  Calendar,
  Send,
  Upload,
  Image,
  Palette,
  X,
  Check,
} from 'lucide-react';
import { quoteApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

// ============================================================
// INTERFACES
// ============================================================
interface ArtworkOption {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
}

interface QuoteLineItem {
  id: string;
  productId?: string;
  productName?: string;
  description: string;
  quantity: number;
  dimensions?: {
    width?: number;
    height?: number;
    length?: number;
  };
  pricingUnit?: string;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  estimatedDays?: number;
  artworkChoice?: string;
  artworkUploadUrl?: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  children?: Category[];
}

interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  basePrice: number;
  pricingUnit: string;
  minQuantity: number;
  estimatedLeadDays?: number;
  artworkOptions?: ArtworkOption[];
  category?: { id: string; name: string; icon?: string };
}

// ============================================================
// CONSTANTS
// ============================================================
const PRICING_UNIT_LABELS: Record<string, string> = {
  EACH: 'per item',
  SQFT: 'per sq ft',
  SQIN: 'per sq in',
  LNFT: 'per linear ft',
  HOUR: 'per hour',
  SET: 'per set',
  PACK: 'per pack',
};

const CATEGORY_ICONS: Record<string, string> = {
  'Signs & Inserts': '🪧',
  'Banners': '🎌',
  'Decals & Stickers': '🏷️',
  'Frames & Stands': '🗂️',
  'Vehicle Graphics': '🚗',
  'Large Format Printing': '🖨️',
  'Service Centers': '🧹',
  'Hardware & Accessories': '🔧',
  'Trade Show & Events': '🎪',
};

// Color palette for artwork option cards when no thumbnail is available
const ARTWORK_COLORS = [
  'from-blue-400 to-blue-600',
  'from-green-400 to-green-600',
  'from-purple-400 to-purple-600',
  'from-orange-400 to-orange-600',
  'from-pink-400 to-pink-600',
  'from-teal-400 to-teal-600',
  'from-indigo-400 to-indigo-600',
  'from-red-400 to-red-600',
  'from-cyan-400 to-cyan-600',
  'from-amber-400 to-amber-600',
];

// ============================================================
// COMPONENT
// ============================================================
export function QuoteBuilderPage() {
  const [step, setStep] = useState<'category' | 'product' | 'configure' | 'review'>('category');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [currentItem, setCurrentItem] = useState<Partial<QuoteLineItem>>({
    quantity: 1,
    dimensions: {},
  });
  const [notes, setNotes] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Artwork state
  const [selectedArtwork, setSelectedArtwork] = useState<ArtworkOption | null>(null);
  const [artworkMode, setArtworkMode] = useState<'stock' | 'upload' | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch categories
  const { data: categoriesData, isLoading: loadingCategories } = useQuery({
    queryKey: ['quote-categories'],
    queryFn: () => quoteApi.getCategories().then((r) => r.data.data),
  });

  // Fetch products for selected category
  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['quote-products', selectedCategory?.id],
    queryFn: () => quoteApi.getProducts(selectedCategory?.id).then((r) => r.data.data),
    enabled: !!selectedCategory,
  });

  // Calculate price mutation
  const calcRequestId = useRef(0);
  const calculateMutation = useMutation({
    mutationFn: (data: { productId: string; quantity?: number; dimensions?: any; _reqId?: number }) =>
      quoteApi.calculatePrice(data).then((r) => ({ ...r.data.data, _reqId: data._reqId })),
    onSuccess: (result) => {
      if (result._reqId !== calcRequestId.current) return;
      setCurrentItem((prev) => ({
        ...prev,
        unitPrice: result.unitPrice,
        totalPrice: result.totalPrice,
        estimatedDays: result.estimatedLeadDays,
      }));
    },
  });

  // Debounced price calculation
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedCalculate = useCallback(
    (data: { productId: string; quantity?: number; dimensions?: any }) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      const reqId = ++calcRequestId.current;
      debounceTimer.current = setTimeout(() => {
        calculateMutation.mutate({ ...data, _reqId: reqId });
      }, 300);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // Artwork upload mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => quoteApi.uploadArtwork(file).then((r) => r.data.data),
    onSuccess: (result) => {
      setUploadedFileUrl(result.url);
    },
  });

  // Submit quote mutation
  const submitMutation = useMutation({
    mutationFn: () =>
      quoteApi.create({
        items: lineItems.map((item) => ({
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: item.notes,
        })),
        notes,
      }),
    onSuccess: () => {
      setShowSuccess(true);
    },
  });

  const categories = categoriesData || [];
  const products = productsData || [];

  const subtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + item.totalPrice, 0),
    [lineItems]
  );
  const maxLeadDays = useMemo(
    () => Math.max(...lineItems.map((item) => item.estimatedDays || 5), 5),
    [lineItems]
  );

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleSelectCategory = (category: Category) => {
    setSelectedCategory(category);
    setStep('product');
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedArtwork(null);
    setArtworkMode(null);
    setUploadedFile(null);
    setUploadedFileUrl(null);
    setUploadPreview(null);
    setCurrentItem({
      productId: product.id,
      productName: product.name,
      description: product.name,
      quantity: product.minQuantity || 1,
      pricingUnit: product.pricingUnit,
      dimensions: {},
      unitPrice: Number(product.basePrice),
      totalPrice: Number(product.basePrice) * (product.minQuantity || 1),
      estimatedDays: product.estimatedLeadDays || 5,
    });
    setStep('configure');

    const reqId = ++calcRequestId.current;
    calculateMutation.mutate({
      productId: product.id,
      quantity: product.minQuantity || 1,
      _reqId: reqId,
    });
  };

  const handleUpdateQuantity = (quantity: number) => {
    setCurrentItem((prev) => ({ ...prev, quantity }));
    if (selectedProduct) {
      debouncedCalculate({
        productId: selectedProduct.id,
        quantity,
        dimensions: currentItem.dimensions,
      });
    }
  };

  const handleUpdateDimensions = (key: 'width' | 'height' | 'length', value: number) => {
    const newDimensions = { ...currentItem.dimensions, [key]: value };
    setCurrentItem((prev) => ({ ...prev, dimensions: newDimensions }));
    if (selectedProduct) {
      debouncedCalculate({
        productId: selectedProduct.id,
        quantity: currentItem.quantity,
        dimensions: newDimensions,
      });
    }
  };

  const handleSelectArtwork = (artwork: ArtworkOption) => {
    setSelectedArtwork(artwork);
    setArtworkMode('stock');
    setUploadedFile(null);
    setUploadedFileUrl(null);
    setUploadPreview(null);
    // Update description to include artwork choice
    setCurrentItem((prev) => ({
      ...prev,
      description: `${selectedProduct?.name} — ${artwork.name}`,
      artworkChoice: artwork.name,
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setArtworkMode('upload');
    setSelectedArtwork(null);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setUploadPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setUploadPreview(null);
    }

    // Upload the file
    uploadMutation.mutate(file);

    setCurrentItem((prev) => ({
      ...prev,
      description: `${selectedProduct?.name} — Custom Artwork`,
      artworkChoice: 'Custom Upload',
    }));
  };

  const handleRemoveUpload = () => {
    setUploadedFile(null);
    setUploadedFileUrl(null);
    setUploadPreview(null);
    setArtworkMode(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setCurrentItem((prev) => ({
      ...prev,
      description: selectedProduct?.name || '',
      artworkChoice: undefined,
    }));
  };

  const handleAddToQuote = () => {
    if (!currentItem.description) return;

    const newItem: QuoteLineItem = {
      id: `item-${Date.now()}`,
      productId: currentItem.productId,
      productName: currentItem.productName,
      description: currentItem.description || '',
      quantity: currentItem.quantity || 1,
      dimensions: currentItem.dimensions,
      pricingUnit: currentItem.pricingUnit,
      unitPrice: currentItem.unitPrice || 0,
      totalPrice: currentItem.totalPrice || 0,
      notes: currentItem.notes,
      estimatedDays: currentItem.estimatedDays,
      artworkChoice: currentItem.artworkChoice,
      artworkUploadUrl: uploadedFileUrl || undefined,
    };

    setLineItems((prev) => [...prev, newItem]);
    setCurrentItem({ quantity: 1, dimensions: {} });
    setSelectedProduct(null);
    setSelectedCategory(null);
    setSelectedArtwork(null);
    setArtworkMode(null);
    setUploadedFile(null);
    setUploadedFileUrl(null);
    setUploadPreview(null);
    setStep('category');
  };

  const handleRemoveItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const needsDimensions = selectedProduct?.pricingUnit &&
    ['SQFT', 'SQIN', 'LNFT'].includes(selectedProduct.pricingUnit);

  const hasArtworkOptions = selectedProduct?.artworkOptions && selectedProduct.artworkOptions.length > 0;

  // ============================================================
  // RENDER: SUCCESS SCREEN
  // ============================================================
  if (showSuccess) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </motion.div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Quote Request Submitted!</h1>
        <p className="text-gray-600 mb-8">
          Our team will review your request and send you a finalized quote within 24 hours.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/quotes" className="btn-primary">
            View My Quotes
          </Link>
          <button
            onClick={() => {
              setShowSuccess(false);
              setLineItems([]);
              setNotes('');
              setStep('category');
            }}
            className="btn-secondary"
          >
            Start New Quote
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: MAIN
  // ============================================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/hub"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Hub
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calculator className="w-7 h-7 text-primary-600" />
            Instant Quote Builder
          </h1>
          <p className="mt-1 text-gray-500">
            Build your quote and get instant pricing estimates
          </p>
        </div>

        {lineItems.length > 0 && (
          <button onClick={() => setStep('review')} className="btn-primary">
            Review Quote ({lineItems.length})
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        )}
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 text-sm">
        {['category', 'product', 'configure', 'review'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => {
                if (s === 'category') setStep('category');
                else if (s === 'review' && lineItems.length > 0) setStep('review');
              }}
              className={cn(
                'px-3 py-1 rounded-full font-medium transition-colors',
                step === s
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
            {i < 3 && <ChevronDown className="w-4 h-4 text-gray-400 rotate-[-90deg]" />}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {/* ============================================================ */}
            {/* Step 1: Category Selection */}
            {/* ============================================================ */}
            {step === 'category' && (
              <motion.div
                key="category"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="card p-6"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  What type of product do you need?
                </h2>

                {loadingCategories ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                  </div>
                ) : categories.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No product categories available</p>
                    <p className="text-sm mt-2">Contact us directly for a custom quote</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {categories.map((category: Category) => (
                      <motion.button
                        key={category.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelectCategory(category)}
                        className="p-4 border-2 border-gray-200 rounded-xl text-left hover:border-primary-500 hover:bg-primary-50 transition-all"
                      >
                        <div className="text-2xl mb-2">
                          {category.icon || CATEGORY_ICONS[category.name] || '📦'}
                        </div>
                        <h3 className="font-semibold text-gray-900">{category.name}</h3>
                        {category.description && (
                          <p className="text-sm text-gray-500 mt-1">{category.description}</p>
                        )}
                        {category.children && category.children.length > 0 && (
                          <p className="text-xs text-primary-600 mt-2">
                            {category.children.length} subcategories
                          </p>
                        )}
                      </motion.button>
                    ))}
                  </div>
                )}

                {/* Custom Item Option */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setCurrentItem({
                        description: 'Custom Item',
                        quantity: 1,
                        unitPrice: 0,
                        totalPrice: 0,
                      });
                      setSelectedProduct(null);
                      setStep('configure');
                    }}
                    className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-primary-500 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add Custom Item (describe what you need)
                  </button>
                </div>
              </motion.div>
            )}

            {/* ============================================================ */}
            {/* Step 2: Product Selection */}
            {/* ============================================================ */}
            {step === 'product' && (
              <motion.div
                key="product"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="card p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setStep('category');
                    }}
                    className="text-gray-500 hover:text-gray-900"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedCategory?.name} Products
                  </h2>
                </div>

                {loadingProducts ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No products in this category</p>
                    <button
                      onClick={() => setStep('category')}
                      className="text-primary-600 hover:underline mt-2"
                    >
                      Choose another category
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {products.map((product: Product) => (
                      <motion.button
                        key={product.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => handleSelectProduct(product)}
                        className="w-full p-4 border border-gray-200 rounded-xl text-left hover:border-primary-500 hover:bg-primary-50 transition-all"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-gray-900">{product.name}</h3>
                            {product.description && (
                              <p className="text-sm text-gray-500 mt-1">{product.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Hash className="w-3 h-3" />
                                SKU: {product.sku}
                              </span>
                              <span className="flex items-center gap-1">
                                <Ruler className="w-3 h-3" />
                                {PRICING_UNIT_LABELS[product.pricingUnit] || product.pricingUnit}
                              </span>
                              {product.estimatedLeadDays && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  ~{product.estimatedLeadDays} days
                                </span>
                              )}
                              {product.artworkOptions && product.artworkOptions.length > 0 && (
                                <span className="flex items-center gap-1 text-primary-600">
                                  <Palette className="w-3 h-3" />
                                  {product.artworkOptions.length} designs
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary-600">
                              {formatCurrency(Number(product.basePrice))}
                            </p>
                            <p className="text-xs text-gray-500">
                              {PRICING_UNIT_LABELS[product.pricingUnit]}
                            </p>
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ============================================================ */}
            {/* Step 3: Configure Item (with artwork selection) */}
            {/* ============================================================ */}
            {step === 'configure' && (
              <motion.div
                key="configure"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="card p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => {
                      if (selectedProduct) {
                        setStep('product');
                      } else {
                        setStep('category');
                      }
                    }}
                    className="text-gray-500 hover:text-gray-900"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Configure: {selectedProduct?.name || 'Custom Item'}
                  </h2>
                </div>

                <div className="space-y-6">
                  {/* ============ ARTWORK SELECTION ============ */}
                  {hasArtworkOptions && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <Palette className="w-4 h-4 text-primary-600" />
                        Choose Your Artwork
                      </label>

                      {/* Stock artwork grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                        {selectedProduct!.artworkOptions!.map((artwork, idx) => (
                          <motion.button
                            key={artwork.id}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleSelectArtwork(artwork)}
                            className={cn(
                              'relative rounded-xl overflow-hidden text-left transition-all border-2',
                              selectedArtwork?.id === artwork.id
                                ? 'border-primary-500 ring-2 ring-primary-200'
                                : 'border-gray-200 hover:border-primary-300'
                            )}
                          >
                            {/* Artwork thumbnail or gradient placeholder */}
                            {artwork.thumbnailUrl ? (
                              <img
                                src={artwork.thumbnailUrl}
                                alt={artwork.name}
                                className="w-full h-28 object-cover"
                              />
                            ) : (
                              <div
                                className={cn(
                                  'w-full h-28 bg-gradient-to-br flex items-center justify-center',
                                  ARTWORK_COLORS[idx % ARTWORK_COLORS.length]
                                )}
                              >
                                <Image className="w-8 h-8 text-white/80" />
                              </div>
                            )}
                            <div className="p-2">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {artwork.name}
                              </p>
                              {artwork.description && (
                                <p className="text-xs text-gray-500 truncate">{artwork.description}</p>
                              )}
                            </div>
                            {/* Selected checkmark */}
                            {selectedArtwork?.id === artwork.id && (
                              <div className="absolute top-2 right-2 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </motion.button>
                        ))}
                      </div>

                      {/* Upload Your Own divider */}
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-200" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-white px-4 text-sm text-gray-500">or</span>
                        </div>
                      </div>

                      {/* Upload your own artwork */}
                      {!uploadedFile ? (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className={cn(
                            'w-full p-6 border-2 border-dashed rounded-xl transition-all flex flex-col items-center gap-2',
                            artworkMode === 'upload'
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                          )}
                        >
                          <Upload className="w-8 h-8 text-gray-400" />
                          <span className="font-medium text-gray-700">Upload Your Own Artwork</span>
                          <span className="text-xs text-gray-500">
                            PNG, JPG, PDF, AI, EPS — up to 50MB
                          </span>
                        </button>
                      ) : (
                        <div className="border-2 border-primary-500 rounded-xl p-4 bg-primary-50">
                          <div className="flex items-start gap-4">
                            {uploadPreview ? (
                              <img
                                src={uploadPreview}
                                alt="Upload preview"
                                className="w-20 h-20 rounded-lg object-cover border border-gray-200"
                              />
                            ) : (
                              <div className="w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center">
                                <FileText className="w-8 h-8 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">
                                {uploadedFile.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {(uploadedFile.size / 1024 / 1024).toFixed(1)} MB
                              </p>
                              {uploadMutation.isPending && (
                                <p className="text-xs text-primary-600 flex items-center gap-1 mt-1">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Uploading...
                                </p>
                              )}
                              {uploadedFileUrl && (
                                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Uploaded successfully
                                </p>
                              )}
                              {uploadMutation.isError && (
                                <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                                  <AlertCircle className="w-3 h-3" />
                                  Upload failed — try again
                                </p>
                              )}
                            </div>
                            <button
                              onClick={handleRemoveUpload}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      )}

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf,.ai,.eps,.svg,.psd,.zip,.rar"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                  )}

                  {/* Upload-only for products without stock artwork */}
                  {!hasArtworkOptions && selectedProduct && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <Upload className="w-4 h-4 text-primary-600" />
                        Upload Your Artwork (optional)
                      </label>
                      {!uploadedFile ? (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary-400 hover:bg-gray-50 transition-all flex flex-col items-center gap-2"
                        >
                          <Upload className="w-8 h-8 text-gray-400" />
                          <span className="font-medium text-gray-700">Upload Artwork</span>
                          <span className="text-xs text-gray-500">
                            PNG, JPG, PDF, AI, EPS — up to 50MB
                          </span>
                        </button>
                      ) : (
                        <div className="border-2 border-primary-500 rounded-xl p-4 bg-primary-50">
                          <div className="flex items-start gap-4">
                            {uploadPreview ? (
                              <img
                                src={uploadPreview}
                                alt="Upload preview"
                                className="w-20 h-20 rounded-lg object-cover border border-gray-200"
                              />
                            ) : (
                              <div className="w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center">
                                <FileText className="w-8 h-8 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{uploadedFile.name}</p>
                              <p className="text-xs text-gray-500">
                                {(uploadedFile.size / 1024 / 1024).toFixed(1)} MB
                              </p>
                              {uploadMutation.isPending && (
                                <p className="text-xs text-primary-600 flex items-center gap-1 mt-1">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Uploading...
                                </p>
                              )}
                              {uploadedFileUrl && (
                                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Uploaded successfully
                                </p>
                              )}
                            </div>
                            <button
                              onClick={handleRemoveUpload}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf,.ai,.eps,.svg,.psd,.zip,.rar"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={currentItem.description || ''}
                      onChange={(e) => setCurrentItem((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe what you need..."
                      className="input"
                    />
                  </div>

                  {/* Dimensions (if needed) */}
                  {(needsDimensions || !selectedProduct) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dimensions (inches)
                      </label>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs text-gray-500">Width</label>
                          <input
                            type="number"
                            min="0"
                            max="126"
                            step="0.25"
                            value={currentItem.dimensions?.width || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              handleUpdateDimensions('width', Math.min(val, 126));
                            }}
                            placeholder="0"
                            className={cn('input', (currentItem.dimensions?.width || 0) > 126 && 'border-red-500')}
                          />
                          {(currentItem.dimensions?.width || 0) > 126 && (
                            <p className="text-xs text-red-600 mt-1">Max printable width is 126"</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Height</label>
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            value={currentItem.dimensions?.height || ''}
                            onChange={(e) => handleUpdateDimensions('height', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="input"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Length (optional)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            value={currentItem.dimensions?.length || ''}
                            onChange={(e) => handleUpdateDimensions('length', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="input"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quantity */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleUpdateQuantity(Math.max(1, (currentItem.quantity || 1) - 1))}
                        className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={currentItem.quantity || 1}
                        onChange={(e) => handleUpdateQuantity(parseInt(e.target.value) || 1)}
                        className="input w-24 text-center"
                      />
                      <button
                        onClick={() => handleUpdateQuantity((currentItem.quantity || 1) + 1)}
                        className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (optional)
                    </label>
                    <textarea
                      value={currentItem.notes || ''}
                      onChange={(e) => setCurrentItem((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Special requirements, colors, materials..."
                      rows={3}
                      className="input"
                    />
                  </div>

                  {/* Price Display */}
                  <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl p-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-600">Estimated Price</p>
                        <p className="text-3xl font-bold text-primary-600">
                          {calculateMutation.isPending ? (
                            <Loader2 className="w-6 h-6 animate-spin inline" />
                          ) : (
                            formatCurrency(currentItem.totalPrice || 0)
                          )}
                        </p>
                        {currentItem.unitPrice && currentItem.quantity && currentItem.quantity > 1 && (
                          <p className="text-sm text-gray-500">
                            {formatCurrency(currentItem.unitPrice)} × {currentItem.quantity}
                          </p>
                        )}
                      </div>
                      {currentItem.estimatedDays && (
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Est. Lead Time</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {currentItem.estimatedDays} days
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add to Quote Button */}
                  <button
                    onClick={handleAddToQuote}
                    disabled={!currentItem.description}
                    className="btn-primary w-full"
                  >
                    <Plus className="w-5 h-5 mr-1" />
                    Add to Quote
                  </button>
                </div>
              </motion.div>
            )}

            {/* ============================================================ */}
            {/* Step 4: Review Quote */}
            {/* ============================================================ */}
            {step === 'review' && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="card p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => setStep('category')}
                    className="text-gray-500 hover:text-gray-900"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Review Your Quote
                  </h2>
                </div>

                {lineItems.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No items in your quote yet</p>
                    <button
                      onClick={() => setStep('category')}
                      className="text-primary-600 hover:underline mt-2"
                    >
                      Add your first item
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4 mb-6">
                      {lineItems.map((item, index) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl"
                        >
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{item.description}</p>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                              <span>Qty: {item.quantity}</span>
                              {item.dimensions?.width && item.dimensions?.height && (
                                <span>
                                  {item.dimensions.width}" × {item.dimensions.height}"
                                </span>
                              )}
                              {item.artworkChoice && (
                                <span className="flex items-center gap-1 text-primary-600">
                                  <Palette className="w-3 h-3" />
                                  {item.artworkChoice}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">
                              {formatCurrency(item.totalPrice)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </motion.div>
                      ))}
                    </div>

                    {/* Add More Items */}
                    <button
                      onClick={() => setStep('category')}
                      className="w-full p-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-primary-500 hover:text-primary-600 transition-colors flex items-center justify-center gap-2 mb-6"
                    >
                      <Plus className="w-5 h-5" />
                      Add Another Item
                    </button>

                    {/* Notes */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Additional Notes
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Project details, timeline requirements, special instructions..."
                        rows={4}
                        className="input"
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      onClick={() => submitMutation.mutate()}
                      disabled={submitMutation.isPending}
                      className="btn-primary w-full"
                    >
                      {submitMutation.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      ) : (
                        <Send className="w-5 h-5 mr-2" />
                      )}
                      Submit Quote Request
                    </button>

                    {submitMutation.isError && (
                      <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        Failed to submit quote. Please try again.
                      </p>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar - Quote Summary */}
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-600" />
              Quote Summary
            </h3>

            {lineItems.length === 0 ? (
              <p className="text-sm text-gray-500">
                Add items to see your quote summary
              </p>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {lineItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-600 truncate flex-1 mr-2">
                        {item.description}
                      </span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(item.totalPrice)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-semibold">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500 mb-4">
                    <span>Tax & shipping</span>
                    <span>TBD</span>
                  </div>

                  <div className="bg-primary-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-gray-900">Estimated Total</span>
                      <span className="text-xl font-bold text-primary-600">
                        {formatCurrency(subtotal)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      Est. lead time: ~{maxLeadDays} business days
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-4">
                  * Final pricing will be confirmed by our team after reviewing your request.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
