import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, Home } from 'lucide-react';
import { Button } from '../components/common/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
        <div className="w-14 h-14 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200">
          <FileQuestion className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Page Not Found (404)</h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          The requested route does not exist on the Surplus Food Redistribution platform.
        </p>

        <div className="mt-6">
          <Link to="/">
            <Button variant="primary" className="w-full">
              <Home className="w-4 h-4 mr-2" />
              Return to Platform Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
