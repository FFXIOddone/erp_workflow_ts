/**
 * Component Documentation & Showcase
 * 
 * Interactive component documentation and examples.
 * Features:
 * - Live component previews
 * - Code examples
 * - Props documentation
 * - Variant showcases
 */

import React, { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { 
  ChevronRight, 
  ChevronDown, 
  Copy, 
  Check, 
  Code, 
  Eye,
  Search,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PropDefinition {
  name: string;
  type: string;
  required?: boolean;
  default?: string;
  description: string;
}

interface ComponentDoc {
  name: string;
  description: string;
  category: string;
  props?: PropDefinition[];
  examples?: Array<{
    title: string;
    description?: string;
    code: string;
    preview?: React.ReactNode;
  }>;
}

// ============================================================================
// Documentation Page Component
// ============================================================================

interface ComponentDocPageProps {
  docs: ComponentDoc[];
  className?: string;
}

export function ComponentDocPage({ docs, className }: ComponentDocPageProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const categories = useMemo(() => {
    return Array.from(new Set(docs.map(d => d.category)));
  }, [docs]);
  
  const filteredDocs = useMemo(() => {
    return docs.filter(doc => {
      const matchesSearch = !search || 
        doc.name.toLowerCase().includes(search.toLowerCase()) ||
        doc.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !selectedCategory || doc.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [docs, search, selectedCategory]);
  
  return (
    <div className={clsx('min-h-screen bg-gray-50 dark:bg-gray-900', className)}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Component Library
            </h1>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search components..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Category Tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors',
                !selectedCategory
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              All ({docs.length})
            </button>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={clsx(
                  'px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors',
                  selectedCategory === category
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                {category} ({docs.filter(d => d.category === category).length})
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {filteredDocs.map(doc => (
            <ComponentDocCard key={doc.name} doc={doc} />
          ))}
          
          {filteredDocs.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No components found matching "{search}"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Component Card
// ============================================================================

interface ComponentDocCardProps {
  doc: ComponentDoc;
}

function ComponentDocCard({ doc }: ComponentDocCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
      >
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {doc.name}
            </h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
              {doc.category}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {doc.description}
          </p>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </button>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {/* Props Table */}
          {doc.props && doc.props.length > 0 && (
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Props
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Default
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {doc.props.map(prop => (
                      <tr key={prop.name}>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <code className="text-sm text-pink-600 dark:text-pink-400">
                            {prop.name}
                            {prop.required && <span className="text-red-500">*</span>}
                          </code>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <code className="text-sm text-blue-600 dark:text-blue-400">
                            {prop.type}
                          </code>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <code className="text-sm text-gray-600 dark:text-gray-400">
                            {prop.default || '-'}
                          </code>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                          {prop.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Examples */}
          {doc.examples && doc.examples.length > 0 && (
            <div className="p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Examples
              </h3>
              <div className="space-y-6">
                {doc.examples.map((example, i) => (
                  <ExampleCard key={i} example={example} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example Card
// ============================================================================

interface ExampleCardProps {
  example: NonNullable<ComponentDoc['examples']>[number];
}

function ExampleCard({ example }: ExampleCardProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);
  
  const copyCode = () => {
    navigator.clipboard.writeText(example.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Example Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {example.title}
          </h4>
          {example.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {example.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('preview')}
            className={clsx(
              'p-1.5 rounded transition-colors',
              activeTab === 'preview'
                ? 'bg-white dark:bg-gray-600 shadow-sm'
                : 'hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
            title="Preview"
          >
            <Eye className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={clsx(
              'p-1.5 rounded transition-colors',
              activeTab === 'code'
                ? 'bg-white dark:bg-gray-600 shadow-sm'
                : 'hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
            title="Code"
          >
            <Code className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </button>
          <button
            onClick={copyCode}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title="Copy code"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4 text-gray-600 dark:text-gray-300" />
            )}
          </button>
        </div>
      </div>
      
      {/* Content */}
      {activeTab === 'preview' && example.preview && (
        <div className="p-6 bg-white dark:bg-gray-800">
          {example.preview}
        </div>
      )}
      
      {activeTab === 'code' && (
        <pre className="p-4 bg-gray-900 text-gray-100 text-sm overflow-x-auto">
          <code>{example.code}</code>
        </pre>
      )}
      
      {activeTab === 'preview' && !example.preview && (
        <pre className="p-4 bg-gray-900 text-gray-100 text-sm overflow-x-auto">
          <code>{example.code}</code>
        </pre>
      )}
    </div>
  );
}

// ============================================================================
// Quick Doc Generator (for inline documentation)
// ============================================================================

interface QuickDocProps {
  component: string;
  description: string;
  props?: PropDefinition[];
  children?: React.ReactNode;
}

export function QuickDoc({ component, description, props, children }: QuickDocProps) {
  const [showProps, setShowProps] = useState(false);
  
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-6">
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <code className="text-sm font-mono text-pink-600 dark:text-pink-400">
            &lt;{component} /&gt;
          </code>
          {props && (
            <button
              onClick={() => setShowProps(!showProps)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showProps ? 'Hide props' : 'Show props'}
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {description}
        </p>
      </div>
      
      {showProps && props && (
        <div className="px-4 py-3 bg-gray-100 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
          <div className="space-y-2">
            {props.map(prop => (
              <div key={prop.name} className="text-sm">
                <code className="text-pink-600 dark:text-pink-400">{prop.name}</code>
                <span className="text-gray-400 mx-1">:</span>
                <code className="text-blue-600 dark:text-blue-400">{prop.type}</code>
                {prop.default && (
                  <>
                    <span className="text-gray-400 mx-1">=</span>
                    <code className="text-green-600 dark:text-green-400">{prop.default}</code>
                  </>
                )}
                <span className="text-gray-500 dark:text-gray-400 ml-2">
                  — {prop.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {children && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Code Block Component
// ============================================================================

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
}

export function CodeBlock({
  code,
  language = 'tsx',
  showLineNumbers = false,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  
  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const lines = code.split('\n');
  
  return (
    <div className={clsx('relative group rounded-lg overflow-hidden', className)}>
      <button
        onClick={copyCode}
        className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy code"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-400" />
        ) : (
          <Copy className="h-4 w-4 text-gray-300" />
        )}
      </button>
      
      <pre className="p-4 bg-gray-900 text-gray-100 text-sm overflow-x-auto">
        {showLineNumbers ? (
          <code>
            {lines.map((line, i) => (
              <div key={i} className="table-row">
                <span className="table-cell pr-4 text-gray-500 select-none text-right">
                  {i + 1}
                </span>
                <span className="table-cell">{line}</span>
              </div>
            ))}
          </code>
        ) : (
          <code>{code}</code>
        )}
      </pre>
      
      {language && (
        <div className="absolute bottom-2 right-2 px-2 py-0.5 text-xs font-mono text-gray-500 bg-gray-800 rounded">
          {language}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Export Default
// ============================================================================

export default {
  ComponentDocPage,
  QuickDoc,
  CodeBlock,
};
