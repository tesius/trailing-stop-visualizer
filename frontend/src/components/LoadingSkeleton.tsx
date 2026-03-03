const LoadingSkeleton = () => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Stats skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                        <div className="skeleton h-3 w-20 rounded mb-3" />
                        <div className="skeleton h-6 w-28 rounded" />
                    </div>
                ))}
            </div>
            {/* Chart skeleton */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-6">
                <div className="skeleton h-[350px] md:h-[500px] w-full rounded-xl" />
            </div>
        </div>
    );
};

export default LoadingSkeleton;
