#!/usr/bin/env python3
"""Reference values for the analysis-engine fixtures in tests/fixtures/.

Run from the repository root:

    python tests/fixtures/compute_reference.py

It needs Python 3 with numpy, scipy and statsmodels. For every fixture JSON it
rebuilds the model matrix from the documented contract (design spec section 4.2:
factor coding, main effects plus two-factor interactions, term IDs, the later term
in model order is the aliased one), not from the engine's code. It fits each model
listed in the fixture with statsmodels OLS on the estimable columns, which is what
R lm() reports when it gives NA for aliased terms, and writes the numbers into the
fixture's "reference" block. tests/core/analysis/*.test.ts compares the engine
(src/core/analysis/analysisCore.ts) with them.

R was not installed when this script was written (open decision 5 in
docs/task/DOE-Magic/status-and-handoff.md). A port to R lm()/anova() must give the
same numbers. Never edit a "reference" block by hand: change the fixture's inputs
and rerun this script.
"""
import datetime
import json
import math
import pathlib
import platform
import sys

import numpy as np
import scipy
import statsmodels
import statsmodels.api as sm
from scipy import stats

HERE = pathlib.Path(__file__).resolve().parent
ALIAS_TOL = 1e-9  # relative residual norm below which a column is aliased


def contrasts(factor, value):
    """Model-matrix columns for one factor value (design spec section 4.2)."""
    if factor['type'] == 'categorical':
        levels = factor.get('levels') or ['Level 1', 'Level 2']
        idx = [lv.strip().lower() for lv in levels].index(str(value).strip().lower())
        if len(levels) <= 2:
            return [1.0 if idx == 1 else -1.0]
        cols = [0.0] * (len(levels) - 1)
        if idx == len(levels) - 1:
            cols = [-1.0] * (len(levels) - 1)
        else:
            cols[idx] = 1.0
        return cols
    mid = (factor['min'] + factor['max']) / 2
    rng = (factor['max'] - factor['min']) or 1
    x = 2 * (float(value) - mid) / rng
    if abs(x) > 2:
        raise ValueError(f"{factor['id']}={value} codes to {x}; the engine clamps at 2 (STAT-14), keep fixtures inside")
    return [x]


def column_names(factor):
    if factor['type'] == 'categorical':
        levels = factor.get('levels') or ['Level 1', 'Level 2']
        if len(levels) <= 2:
            return [f"{factor['name']}[{levels[1]}]"]
        return [f"{factor['name']}[{lv}]" for lv in levels[:-1]]
    return [factor['name']]


def model_terms(factors, excluded):
    """Active terms in model order: main effects, then 2FIs (i < j)."""
    terms = []
    for f in factors:
        terms.append(dict(id=f['id'], name=f['name'], factors=[f], names=column_names(f),
                          cols=lambda run, f=f: contrasts(f, run[f['id']])))
    for i, a in enumerate(factors):
        for b in factors[i + 1:]:
            na, nb = column_names(a), column_names(b)
            terms.append(dict(id=f"{a['id']}*{b['id']}", name=f"{a['name']}*{b['name']}", factors=[a, b],
                              names=[f'{x}*{y}' for x in na for y in nb],
                              cols=lambda run, a=a, b=b: [x * y for x in contrasts(a, run[a['id']]) for y in contrasts(b, run[b['id']])]))
    return [t for t in terms if t['id'] not in excluded]


def estimable(X):
    """Indices of the columns kept when columns enter in model order."""
    kept = []
    for j in range(X.shape[1]):
        col = X[:, j]
        if kept:
            coef = np.linalg.lstsq(X[:, kept], col, rcond=None)[0]
            resid = col - X[:, kept] @ coef
        else:
            resid = col
        if np.linalg.norm(resid) > ALIAS_TOL * max(1.0, np.linalg.norm(col)):
            kept.append(j)
    return kept


def finite(x):
    return None if x is None or not math.isfinite(x) else float(x)


def lenth(effects):
    """Lenth (1989), Technometrics 31:469-473: PSE, ME and SME of a set of contrasts."""
    a = np.abs(np.asarray(list(effects.values()), dtype=float))
    m = len(a)
    s0 = 1.5 * np.median(a)
    pse = 1.5 * np.median(a[a < 2.5 * s0])
    d = m / 3
    gamma = (1 + 0.95 ** (1 / m)) / 2
    return dict(contrasts=effects, s0=float(s0), PSE=float(pse), df=d, ME=float(stats.t.ppf(0.975, d) * pse),
                SME=float(stats.t.ppf(gamma, d) * pse), t={k: abs(v) / pse for k, v in effects.items()})


def box_cox(y, Xk):
    """Profile log-likelihood of the normalised Box-Cox transform on the engine's lambda grid."""
    shift = abs(y.min()) + 1 if y.min() <= 0 else 0.0
    ys = y + shift
    gm = math.exp(np.mean(np.log(ys)))
    grid = []
    for lam in [round(-2 + 0.1 * i, 1) for i in range(41)]:
        z = gm * np.log(ys) if abs(lam) < 1e-4 else (ys ** lam - 1) / (lam * gm ** (lam - 1))
        sse = float(np.sum((z - Xk @ np.linalg.lstsq(Xk, z, rcond=None)[0]) ** 2))
        grid.append(dict(lambda_=lam, logLikelihood=-(len(y) / 2) * math.log(sse / len(y))))
    best = max(grid, key=lambda g: g['logLikelihood'])
    return dict(shift=shift, optimalLambda=best['lambda_'],
                grid=[{'lambda': g['lambda_'], 'logLikelihood': g['logLikelihood']} for g in grid])


def fit(fixture, model):
    factors = fixture['factors']
    rid = model['responseId']
    runs = [r for r in fixture['runs'] if r['responses'].get(rid) is not None]
    terms = model_terms(factors, set(model['excludedTerms']))
    names = ['Intercept'] + [n for t in terms for n in t['names']]
    owner = [None] + [t['id'] for t in terms for _ in t['names']]
    X = np.array([[1.0] + [c for t in terms for c in t['cols'](r['factors'])] for r in runs])
    y = np.array([float(r['responses'][rid]) for r in runs])
    n = len(y)
    kept = estimable(X)
    Xk = X[:, kept]
    rank = len(kept)
    df_error = n - rank
    res = sm.OLS(y, Xk).fit()
    beta = res.params
    fitted = Xk @ beta
    resid = y - fitted
    sse = float(resid @ resid)
    sst = float(np.sum((y - y.mean()) ** 2))
    xtx_inv = np.linalg.inv(Xk.T @ Xk)
    lev = np.einsum('ij,jk,ik->i', Xk, xtx_inv, Xk)
    mse = sse / df_error if df_error > 0 else None
    df_model = rank - 1
    out = dict(name=model['name'], responseId=rid, excludedTerms=model['excludedTerms'], n=n, rank=rank,
               dfModel=df_model, dfError=df_error, aliasedColumns=[names[j] for j in range(len(names)) if j not in kept],
               sse=sse, sst=sst, rSquared=1 - sse / sst)
    coefs = {}
    for pos, j in enumerate(kept):
        c = dict(estimate=float(beta[pos]))
        if mse is not None:
            se = math.sqrt(mse * xtx_inv[pos, pos])
            c.update(stdError=se, tRatio=beta[pos] / se, pValue=float(2 * stats.t.sf(abs(beta[pos] / se), df_error)))
        if j > 0:
            xc = X[:, j] - X[:, j].mean()
            c['vif'] = float(xtx_inv[pos, pos] * (xc @ xc))
        coefs[names[j]] = c
    out['coefficients'] = coefs
    out['fitted'] = fitted.tolist()
    out['leverage'] = lev.tolist()
    if mse is not None:
        f_model = (sst - sse) / df_model / mse if df_model > 0 else None
        out.update(mse=mse, rmse=math.sqrt(mse), adjRSquared=1 - (sse / sst) * (n - 1) / df_error, fRatio=f_model,
                   modelPValue=finite(stats.f.sf(f_model, df_model, df_error)) if f_model is not None else None)
        r = resid / np.sqrt(mse * (1 - lev))
        out['studentizedResiduals'] = r.tolist()
        out['cooksDistance'] = (r ** 2 / rank * lev / (1 - lev)).tolist()
        out['adequatePrecision'] = float((fitted.max() - fitted.min()) / math.sqrt(rank * mse / n))
        type3 = {}
        for t in terms:
            cols = [pos for pos, j in enumerate(kept) if owner[j] == t['id']]
            if len(cols) != len(t['names']):
                continue  # aliased (fully or partly): the engine reports SS 0
            red = [pos for pos in range(rank) if pos not in cols]
            sse_red = float(np.sum((y - Xk[:, red] @ np.linalg.lstsq(Xk[:, red], y, rcond=None)[0]) ** 2))
            ss = sse_red - sse
            f = ss / len(cols) / mse
            type3[t['id']] = dict(name=t['name'], df=len(cols), ss=ss, fRatio=f, pValue=float(stats.f.sf(f, len(cols), df_error)))
        out['typeIII'] = type3
        out['boxCox'] = box_cox(y, Xk)
    elif all(len(t['names']) == 1 for t in terms):
        # Saturated with 1-df terms only: Lenth on the effects (2β) of the estimable columns.
        out['lenth'] = lenth({names[j]: 2 * float(beta[pos]) for pos, j in enumerate(kept) if j > 0})
    # Lack of fit: group runs by the settings of every factor that appears in an active term.
    active = [f for f in factors if any(f in t['factors'] for t in terms)]
    groups = {}
    for r, yy in zip(runs, y):
        key = tuple(str(r['factors'][f['id']]).strip().lower() if f['type'] == 'categorical' else round(float(r['factors'][f['id']]), 6)
                    for f in active)
        groups.setdefault(key, []).append(yy)
    ss_pure = float(sum(np.sum((np.array(g) - np.mean(g)) ** 2) for g in groups.values() if len(g) > 1))
    df_pure = sum(len(g) - 1 for g in groups.values() if len(g) > 1)
    df_lof = df_error - df_pure
    ss_lof = sse - ss_pure
    lof = dict(ssPure=ss_pure, dfPure=df_pure, ssLof=ss_lof, dfLof=df_lof, fLof=None, pLof=None)
    if df_lof > 0 and df_pure > 0 and ss_pure > 0:
        lof['fLof'] = (ss_lof / df_lof) / (ss_pure / df_pure)
        lof['pLof'] = float(stats.f.sf(lof['fLof'], df_lof, df_pure))
    out['lackOfFit'] = lof
    return out


def main():
    tool = (f'statsmodels {statsmodels.__version__} OLS (numpy {np.__version__}, scipy {scipy.__version__}, '
            f'Python {platform.python_version()}) via tests/fixtures/compute_reference.py')
    for path in sorted(HERE.glob('*.json')):
        fixture = json.loads(path.read_text(encoding='utf-8'))
        fixture['reference'] = dict(tool=tool, computed=datetime.date.today().isoformat(),
                                    models=[fit(fixture, m) for m in fixture['models']])
        path.write_text(json.dumps(fixture, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
        print(f'{path.name}: {len(fixture["models"])} model(s)')


if __name__ == '__main__':
    sys.exit(main())
