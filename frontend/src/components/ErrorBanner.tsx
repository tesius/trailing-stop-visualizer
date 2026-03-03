interface ErrorBannerProps {
    error: Error & { response?: { data?: { detail?: string } } };
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({ error }) => {
    const message = error.response?.data?.detail || error.message;

    return (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 animate-fade-in-up">
            <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-400 text-xs font-bold">!</span>
                </div>
                <div>
                    <p className="text-sm font-medium text-red-400">Analysis failed</p>
                    <p className="text-sm text-red-400/70 mt-1">{message}</p>
                </div>
            </div>
        </div>
    );
};

export default ErrorBanner;
