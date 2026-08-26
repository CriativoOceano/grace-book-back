// Blocos de HTML reutilizados em todos os templates de e-mail.
//
// Tudo aqui usa <table> pra layout, não display:flex/grid — clientes de
// e-mail (principalmente Gmail e Outlook) ignoram ou renderizam flex/grid
// de forma inconsistente, o que era a causa real dos campos aparecendo
// desalinhados. Tabela com células é o único jeito confiável de alinhar
// coisas lado a lado em e-mail HTML.

export const CORES = {
  azulAbissal: '#0A2647',
  douradoPresenca: '#CBA135',
  verdeMontanha: '#4E944F',
  vermelhoCancelamento: '#DC2626',
  brancoPerola: '#FAFAFA',
  areiaSereno: '#F6EBD9',
  textoMuted: '#4B5D59',
};

const LOGO_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAYKADAAQAAAABAAAAYAAAAACpM19OAAAwgElEQVR4Ac19B3yURfr/zPu+u5tCFRULSrXXExQVUkDPEgiKmATFdnZO7q9Y8PTUwy566t15Z+HU805RSAAFErAgJaF4KupPxYoBRMWGqJCyu+/7zv/7nXffZbPZ3WyQ8HHC7ttmnpl5+vPMvIsQv+Kilvftrer6HrE9Q1RCSLViwG/U4gG9tqf9zmpj7KyO2tuPWtpvnDDkW8IyXle1/W5tT3ulhBS1/e4HCV4XOWqVqus/uj3td2ZduTM7y7Yv9ebAgGjcvEqE5GHCBi87YosIhg+Wx375RTYw1PJ9+gsn8L4wRY4IYIrNaoUsrB+STdudXefXKQG5zcCasoB4Il8IS3QWzTmHZY0cxzwUiM+Jt5cimHXbnVzxV0kAecjqiBDGp8IfnUVBVQdljxt5CLjfK4Thik+yb7tza/pT3Lm9ZtObUh/ECcD6pjg0m2ZeHaguaC5dNO3U6tjVr+5gdeSIVG3vPYU0/wwVso9oEg/L4fU17ejvPXCuV6iGlDiAxlXKOGpTgkIdU9SqA4RLzKOwrRDv6e8sv9SS/qeKkLhcOO7HQgRvl0M/3pJl03ZX61ACAPm3i87GRSIKdgyJQngjxbLgs1VZjVIaH6GdDX/GEq5m575iZa/uQnzxQ8b2S/rsJgxjX+GgDWkQVc3CcD7L2CbhIVzfQlB7tjBhQ0LQYw2RMB7fnFBlh552tAraXYSBiCZ8AqITEHm3qoxr58wTyTM+ByI2aSRSEqTYVYStfTM3wtOA6CNM1V1Lj6Gl4DsRDGbnPa0+JChsMUVYQH4zxkwPTMgBbfb5Cyp0LAGUfDauRjihgPyt6Nl3TFbjHfjJD0Kp9eBEqh+2DQAx+7XZ1jEORl1vXtoQq3oxeE12KuT7pnNEyDhWMw07svFRalabff6CCh1LgLxus0TUXSqCmhM9lWDIW9VrA7q0NWboevL9J3FDzJEq2bYhljDWse50WyU+bstucCxq8f67ot1NcYYJAYjtviy+Xvs8n3dU6VACyEGropjQzTCEUY0UbQvkgaLZmZDVhKR8P45MSoESh7TdTh4cRyIrS/F+221Qw7KvETmyr1Y7JCBthylvkuUxM54VkPZX6lACcDiyeG0dDOI0RLXe6EgEw7harezTx7uR4dtVH8anT29Giv3UY4iS0xT15l55UBn94wTQfYmP0lSP31a1+x6MiytEhFRG4Vgd8aQcUv+Gd6PjvjucAHro0rodevUHrRKIyBzRQ0SNW9qelvUpODGspYCekII7O2DL7mnbbcndC3X30h4QZ2arBriSa9LWjz8wJ0NNdtaEo80Jq6+Fa9wdf9yBJzuFALLgk3pg78G4LaBnZMpxqrZ/5vxMxPkKc/8GSTkiH5IjugnL6Z0WH6bTHz4WpIB10UbKL0V+9Ju09fFA1fY5Gcb9jLjhpWOuxBQ5bE1WnlMm2Nk82ykE0APJlQ9hkh/DQ/GQaTE/496hFhdzyqnLifU/48E67bgSqUGYU+FmSEkYB2n4hKZnpurloK8aeZmqqMV9coQybgexvMQFxxZx3xF5zVNT1e+Ie+0iAL0XcO3NyLM/iHRx9skxjFwOqv8JevXW+CQoBQGjWMj1Z8XvJZ1o70WKDz1k4iHwA65Ob4gVPCASioUzU0bmFIQ0LoThPVrrfsIWysUYb8lENNZKLmrRvoeolf0eQNr8FrXsgM7JzzNdZ00AzEuKsHu36CxvA+9eBU5brJb2Lc8EvNWzooGV0OmvxlURkWXIW1Tdvohw0xQltyGRjimRnKKoyUC5IZCCiD0kbJU+B6Re69sTknWj9vXZhIY3ouaJorXVMQhZHaDCThchaxGYaSKi/luFE7kjq4axSlkTQFRielIM1bqyEbNUMKSWMU3V9bs+2w6lrHJg3OCWxgwrI80cRJqudWVaGKZYDaJ5j4lcqfqrxYd0alW/qE8XIL+vJgC5OYKskOV+2KqefyMiJwHpe8cNdhgGW4L728g1+c15xGrdNcIyZ0AqdxfECaVaysH8TqyX6TxrAmh/WKkqrY8JnrkWhZx9QN4DIjyuXuqZn6kj/5ksXrMSbZ+Ou6V0/QxxJVRa6ijXtteCS7eijtenkHsKq2kvH178qKy9Me1ddd6I43PhdbmIpFMUVdv3cMC7LO52MlBU6hFZuPbdFNVb3eJc1bJ+j4IB/4I+kL7Qc/DR/h9Ca9UozY2sCaDbu2vvEc3uTRi8q1ME5EgvuLpI5OXPyXr91RR3YPLfaWISRkh2A2enTni5ciMQ+2XcEzJlLrisf6v5WG4feDMhPXV6QIbYIArWf5tcTy9XCnkrGCdfSwtdgGa1QTQZ9yXXTXWt55if/wLU6GUa8Rw/XVcpbREW14uC+kdTtUt3r10EkMOELQvW3gmOPA9E/gmT8GjNPE9QniAC7kJw1zHpOvPvyyFr1wNR9+v2vKndUmMsbEqhX8c/ymHrmnG+RhOLNxmGOS4Dp5ZFQv/7/hR9GmV8CnXCqKNlqetXgnqnxblfJ+zU7fLkz1oRq2VDgFzWb5AIuq9g3CfqZB35nDgQajPSFuNk4Wf3tkeFEX67CMAGLLKofhoQOBKqZG1clRCJljxAmMZ8eANtJ9xk4GFM4oM4EU2gVso7VSUykslFqXfiBOCIpZGXXAXXPeOz0Sto4s3kOrFI+Xb042l6qp6Iu1JsNf+bXDf5Wi/sS7EA3H6gZhhWoOF21RoRdUbIorWVyW2yud4uAhCwHFq/TETlSeCkFTCkXl86lFc9MMjnwM3XZhqAt8ih/hzXlmwblENFT2Qkk4spnsaCzhciF8NtFl9BHc1OrgJE1IiI+FmPpdF9V1jhaa3qbM29WOQYv9Fqk0N2IMvKuEmWrGHOP23BXK4BA0zHrHeNSw7nHFV1wnZOksXrV6Zt3MaDGObaqJXhsaqGC9kV3BwUY/XgKJYkK7kwqh6GaF4TUyOtoOi1gT36ViMFfIrmKopzFFKR13x0si8OV7WfyAkeJbaqd+Swz1KmF3RskiP2FRF7hSz4fHNih2rh3j1EKLQKxOutHQgisElNgzS3JnisoQ7UAsYDmMv4uL4nxig5UfUsMr1XYG4/JvbT3nOC+8VFR7PW57eDS/6oDRsNEyFr39qtAddeJE9cmzIloPWqEMtYWw/ERW3485Cwz/X1DvryNnjJtwFOegYdNsyQg+TxaYi5uM8e8O2fALJLNHOQsbx4mWrnDrFx7eQdkSndbhWUiBc5bAmMc/0NEOjxmF6T5n4OWBtnYwTUwotq2b4pI1gg+k1w172aq6hiFPRs99yvE+HvkHM77zPAXi7y0IfBiFf9KS3yuRsvYLykkc85cC6UaCUaMNaL4YjcvCOQz3ntEAlIRJBa0vtUETSfBHftEdeXFFnH/QoE+h2M1cuJ9Xmuo9hh/U6H7egsGrbOlCd/05Bcx79Wr/TrKvLdPUXE6i6UHRKmGQVLbhFWYJMQjT/I479o8usmH9WKXrsIGRoFFfW5LFq/KPk5r6HvRwHZUzGWni3HDxsUUb+Tw+oXpmq3vfd2OAH0JMhBUv4XHHS4lgLe1J4Jok1bTUTA86/2DFgHTlKeimBpOHjmYLDNLuDGPCCJ6oCcGcG9rThugvp6DzcWQEcvhH5e175++k0EzLsBK6R1PhvTVkTUm8JxzgPR0kfW7ekooW5KAtD4pDOcCW0znqpl++wlVPAJTMUzsBRj6lBDAl3qRlFYPyWTz6wWw1sPDhghpDsB3spQ2JMcbV8YgdPGsBAmC2ehP/jyY4EoImEhXkSdf0M9ZuRa7Qzs2X8KHOFrNOITbVhUvSB+arxUlnz9Hbva3gLpy00lnS0IoJb1PQAzeQTc2wuTfgu7C6qEay9K9iiyHQQ7FXaQAdd47XlwYp7VccG5x0ESXk8FSy3COkFI3QakDtcGk9G2j2w2IAxQTyOd1whv9XOfMLzHOtrP17HvHOwTuiPdlhionZNEEDqfKQX2w7aULlv9TeySO8nbqYd77SzqRai8vADmYJQB5lGYM9a4I5eCEF/6oHx+8a5dOVl0MoZptRES+2HQFdiiuVYt618DHV4lGsz/teUz+4B5jFH898gVfYwB3ANCYL8mZshdC1HVNbEuz7XbF5R/QlriGiA+19PBqE82ITKJGMYLSmyGFGwG4htxz8I1k3NYrJGdtATYuCIyaUAl/gLydNifE+Bx3SW+yn1AlnPrY2IxuusIm+3oCrtIFkbd68AgDyXWyuZcz8EUgzXShRgBQvbR4ybsPGOAaAjcgLMJPixOLV4QwdaIfKNENCSwEjmB4b/O9Il3sDNhFgC+IId8lt1idwy6WgbjLK2H0HZvIHGacN0JiWpOLUR6OCT+g5jgZI1kXw1oLgb6BDwYF7pdGq8Jw10LTsJ+n5624Eber5pygfzdhKUOBFGKIB2nAO2Harujg0O0jkuEmAvGulgWromrFDUfuzQ6uf8B8ktAzM/BbFfD05kXG3pWB7UC6yOuGI32zAIcrl1wuAea4XwI+RhEg/MMCHuuf6slAZb3OxoPnsDAvcUWir5PC9akIaUejyh6GivxrAoTm5+tz65FMhTaJTmQUov37iWs0EwgfzCSfQCNwr68HXGzgPT7xZA1r+EOBtR28bjQOAFj+3+QpJN0K0oei2dU38Ca9BmJy47aDvTs1w+M8R0YI6vgSr3atzckcwSgnonPcdpOkVXYlz9SEl7ni3hffCDCzjjAfwdXuhCtLYres+M4p4HTK/CgEB10RkNPpH2gbEWgPEbheSj1CkRtBoAvyXbwaKlLDFnVIhfJPO6gYyHX2+pLwJ0ITqzybrb/W7u3J/QdB4ngbje4rjH4HhHqoGZGtXu8XDwyrOEYWzlwdCLGSo+MkfE2pPv4IfKbEfDBuQUjVMJtnp9sT1k1bVGvIUdvSxBDlaHSIFAYuhtnPjexpU9hj0jrQJQa6PAZYsja5bCTvvywZsqC9O6xIoSEGDmHhdFzVDHPBJ87dZTqVcz+Wy2CcxE0noIq3bbrLRf9NCKdsLj+XFi+jOP0nAmrUBjmmcDFSSDmvnreiRqCw6HU0qpGFG3Ma0B8FdRZDdzXtXycqmQkgN9ApxqMDccggqR+KwW376dVEQ1dYsLXtxe2Xlt9CVS/ALYiY5pX1e3fD5zxFhJtXfWkmpwXQYCz2suZ/ljTHdXCA3uI3MgMIOmEmD3zpDiixuPtmZQ5fLW0d19hWWVQhXhdCnqdUp/MgP6cPel6DwSaI5T5vChY83YmN9sfZ1YE8CvzqA1WZ7cQYs2BwX1DxEsoidzAaxqcn+0rZfG6v7NdpqKjz1zzYiDmXUzyXnnsGu6G2O5SXl00DOHGcCDbdCLijUNWLZ0zGVyu14GjciHuH6rHS3vmim+FHR4oh7V8/Ukt7X+eCGArjQUVQ+kks/nFl3rKjY3FHCnnAweVIuKsAONw/SLr0m4CJELWngsXJ0wQg95HECtbHCcHSwJsgTdRWP9gYpuOPAeSjQ+PLrgPaxITTUuvtGCfgxJu2J3RKBounFe6qhGIPR6IfQWIz9OKh/agWf0V45zoj01xl/Smpvcwn/3jdoOYits9BHlKLMKcZ4hIaLE88SOkQbav/CICJHapXsWLccHgCAzqNIgr92dCBxqXJrp7ifU74ryseuilVsh6zI24GEasB8wwkGOKaLN9b+WIuut5Vy3pey988ut0nEBudrENXriHycL1G/VzbqHfo2+N6GSerNUVJSWMvaJCYU4Snp+q0at6rPwLyw4jQOI4uM0k0dpXzB+OHWturh0RtmVGolgEMd2o5IK+CRYNGoYVcFwVoP1Spmg2bfXjs6W1nybCbOt83PzBXSJu6G3Tkv3cRHWBhhLCoITa6jjiqFmAq17qvzv4/20gEtsYUUFLgfsH+Of/8PtRK/ociB0cD0C19AAzLcBnFtYO3vOf76hjhxDAH9yoOUM655jmI4YpT4cqyMUHb7xImjHyFPHNrS7EDr+9As4FwuCQqleUY/2+qnRRPGyP1Uh5KJtXNNoMitkubRFLAjxeWpACu8m+sbK07m5eI+icAsRP0lJAt5erW6/WF7flEbHtjiwUwA4pp84/NZRjWk9YueY4ID4faMHGKcnNhfn45ABBFj7s30M+8RbDHfRHrhUyRxnSfq6scmCrlEXqAaszyeksZtCgCpqL03/ynMXVrrMcVRZ/Q8eA/oa7yCaeD3+UGNavv668E786hAA0hp2drQ+ZIaPMbnLi+lgjCNiHFOAfPjGExREfmzj1N9uZIbPAyM9/rDjT/lG0Kass7gREHqtiqoeGF9ScGpH2g05sd7Vy4LJIdbCTP7yX7iavK18C/AgOhEf4ELapCNHmjg7ddgd+dQgBPhhYcDeQd4kT8YIE6U3SVo76Esj5Dp8flVI/AGEbgPwtpEmqYocdYQSNit0bsCUyQ7Fyor0BopcLxJOosAGbrZzgmxs2hD8HktdBBXLXJwJYo4sZ29yrXx4RYpVWhITNMchsXgDJMJDteEQ9jCxk/wFYVB8Eb8BzzdIBIrlM+YNoUIvlb7HZNkUpry683ggYk5woZgxGNBAduo4g4scFDPUuNtMBB6bZ7DQpq3uwUTa6/0T98xx4LixEIAkGYmkXkvcB49ozqws+nzmy7qEUXQrblPuYpgzS+HKfM+iw4QDT2fTcZavs/tWF66RhHMDBEK501P6A8aKGoxJe4PbU337J8PmDIZh0IXJEARDzlxfi0IDqaxZ18oS16y21fMBx0BFzwQl4RyoNKyZ3GxL4AY0BI5NdzLI5BePBbXcpO4Z8j/M3AyFnzRxVV5cMpnxuYbkMyDJNLI6LxIqqDcoR2Luj/ozrvYlUci/8+vvK5xVsgBF9IRmOVHJXqjSNZKo2pb6ZjHVq1sOl96alPkcdV+3B+7pIiRcxYudaa4kW9kbvgnPcxfCY+sbfO45V/0UHA1RQ7udYfznJwFLbZQg48AooRsD8eTaffOMYsFJx4iDK5hZcAJ3/N+hvgzpcqx1Ac23n/Jkjl7ZGPqJVacnHASOXkqK5XmFZUcrzK0uX/gvjOheI36LvU7UoZIlM+SS8neMS++U5ntGoewVHpWR8nw8kr8X7AdKAlG8rzexbFx6lyOVQYndAdXcwUiR99cbbbPCSbR1u5M3hu8ziXO7yxGILuqUvTHesrQ+TWE1uM0RyjT/Q8pqhZ0GNPAqEBTBhqBE9GRs6/rLK0mXz/Hr+saK68CCoiqehbjpT1ZB58Q/bpNTllSOXLma9ytOWL4bncjke2HxOL0aaRnfDVM+WvVg8wIfFo5JgGyLQL9LVqlVfSrzemlBQl25wrDgtCAdiRNHVNkhUUWG1BZnatvHSFt4SnxPXYSDKFEst7Iefid/WOQc5j1IQgitL2wbgj3PbEc6j3IR62NC0/m3epv8NhJOTQ0S+5h9Dht2oe21Vad1/tzX1zsrmF+wGZD0Lnb23r/dBPBENOzfPLK2blli/qrT22fJ5Rb1giKco2BTApIvZB4R67qx5xac+V7rke12fdilGAR4QXHTBUW9ABPG89IgP2JWb/VPMdNt2RuAEY29h1xh4QU2MAFkuRz6oG2r4CisOol0nGBP+sG0e442qarzA+Aq73e5SNr9wuCEldbLmZAKi3w2dPisatn9v5Sk7HDai0UCXyILXF0RH/Wbwbjlm6EmoqhIn7M0F53inwX20ckTt+HQDqZhX8LCZY42nV8SCGAH5M2e+aoyeWVW+sumsBQWHO658E4+w2EmPR60LWTmH9l/5ctMHgwpeh/czkLYkNrYK9KX3cWK3xVSogku02tVcqf6JBfz4cqHurIO/qCy2q5zzYsGehhJP+GrEBxLzfkoCQetjaQc+CJnGO53dhjfKBhWsAPKBDBlHvkZkxF2Ql4e3SzKU3O/Nq0Gkari2uhYJgci2ROYG7uMNe4v9BTj+e22IqQKF2CsS3dr3jUFDu8Ie9KER5024xRGpjA/YhhKCmwe3SKe7coenGthXprLdBIjaxmhwbx+qhRaFCgzGDITphk9PwzT6AemHmQFzMIzovuREFnKjzRfipDr/qWFLMqZwn/rdkmbDlb9zo85bVFcsDogAeJfTKEMKuAXlA3pRWgUFjSDM0Rn5ShaZWLGiamQsgIF9lvsdtrp7BTe0ytXE0VlPJbN6QSPWfocctpsASPL24GQTCz0W/aHVxDMEW9qfJ9JJKBpcFqoJ3PsS7uLZVSV13yXCSHeu9b1rn4+I9ge2Z98gogkCjtBtpFiIVIc+dbE4ghrXwAo8ApdW3wQj4JlaSGKyEoaIAUF90jgyde4g4bYbNu/u5KK9hdGzj+kRzMmZqFw5EG6aDjjANFhWUw0Y3mZssfgeE92EIW9GtLnJMFQD5n+8j9DYmB1cf4lzzjQHnxA+eJsFL/J48UAsH4MKyKs7zc58+PTt2mk2Y+SK9xHovWCG5IUO3Wav7MZDIORWOmFxA4jTRXtiUnQBlvU5nzs2dZOcyfN4cd17RKPgD4IEhGFXtXf/D1Mk3Tc3djWCwa6YdHfhYHHKMnaRruiu3V3ktNAn1CC27GNPJI4S8UwzPLqFB+cb0xiraAIEQqFJgXxrkmcYPS4iFnXBpRfkgBwUZXAxuU+7hgnqBDq6Ji9qnN+QGzLM8NacKH5vJ+gGch3L7ga7sLuUxnVQEcf5KggQkvbm+B1mPgKL6xNrYHg2r589cVk9PKZ/WrnGDXZzLP8UE1FmQqNNdq1o2gP5/G0ltnr17213Wp9dip9GaOoT6t4cNfYBHvq4rjwIgjYAWOiNjMBuMpTTFYzZDWyXz1SjgYfUAn6hFtDF5xcgzgqKc1ZvsVnpKc9fVnI/It93C/3GWR+9/r5/avSSH9O1GVtTcLRhmiBAbBGZDlmaUoa3ZKpabZ7yKpuwol4S1W8MJRMroeDmO5ubug2Gahru2yZKH+b1IaT20hnlVZmJDuqeMbtgDytkHIgtkUfictCPCoY6qnphsN3hTZlak6E/bdiBXDC17h1nWsU6VLMJkYY/tsQjGUJJOQj3PAKgyQcQ3dGJlegexjlfUw9f+uhJgk7vxq7ZDvq8RcCTCIvnqLotOEp+GLtmCruzu/UeuJzDy2t6LFF5xp+qhi3ZmlidYpx4nXj+9MnvNiDIm4AA8A0wWr5mPqVcEOPqqtOWfZJY1z8/o2Z476B0j3aVW6xq1CAZkgOkVD2MoOdxUc1CNWt75hPVb5t8pG2iI6CLf8BAqDkSmZvjggmqZ70YUtRKl/kbFjZUIgxXbwrU0GZl4CcjXZ2q7YyhQJXofTC7oBa4BLreJ0JcZxFI6+ICvDel1s/8O53V1pFWjnUViRvIMw+PNDj0Sp7wn/MI/PtC7d1WOu6OV8nNN9Y2NLjfINDDbgtETq5qCAas9/0KDASxInckFu2L8LxQCfswrCF3M2HPiSgP4UBYLE7R7YATMiNSJzrKp/DS3WZ9vxD5uP7RjqhVOPsWsH/CyLZAin7GeSfUuxrNAhyTE3VoDd5gW00AuHTvA+jPAKJ/SAlcFoFO+8eMNB4KVYSR1+N+RKgT/IECrtbF/oC266iwCxqFnAZlytO+/GpPWYdx9MTkNSMRQYg7w7YzsKy6oBTzOwXXRwMxe8It9pwCEDsVZxPhdBaIZNgtYEyn0dci77QWPLAJNBmFMfbWRCDTYm8NPmOrRta9lDzeM6sLjwdDTCJxaR8goRtlILKa9fQsDz9jxQacv0d9SYBmwOhs2PgFkTSF+hm8srHFYzBti+ukCw+fSTdbXRp76AnF7qcRKo3VeFOjpWAtgWcBJaUZS4sKpBSGcaYVNB+GBzIKiN2TiKChJuLjRjIOENxObhaqEbsp7oFmOAVryUebyjgMEfSQGaW140KB3Bugw7mcqgtgA29yZmUK5LMC1udOgP3QtT0VpV6vOkXHLt5AJ0MhVVTLl0GdITQgelCGuPrs6qGVz45cti134vWnvyExse7JsaCslCPK5xfcqRzjTfjja+1w4wbL7v1jVTl+ngAFyGhpmjDDBHDeqbYjcbCtHqe8kRAHYrzdbW/3Wn9to7wG1BhWog4mF/q6OibBlN64jdIEiLpXzSit+1eqPpujTZMQxe/DtqwLlfIzRn1bqrpllWXQvN+cmshYIF2NXzfeqS2dl6B4bsEDk64ipGB/OCzPjJlXfM2s0iUf+Q38Y6LKIXAQoDva3IhdDRBZNxoI5mySoW82lFcXrMHT1ahf4HJZ0C8tspKxm0yGJeAfjJBKCFDDq0RGwV/+mBeHHWLa7tmOVGMhxf0g4iR4i0KEMxjTq3SOqncc93VA+R9sxBrDMP4FRGrpwxxoMF/rtmfjUy0AxC7OqDm+NxyxK/zFf0TaItLsTsViUcqYxujy9RGwochFkVjATdj9GWHHKz7sOAGMhs1vq9we72IAv2FlGhmE/SUQxiEVC4qeiLrRv88esWK93xDIrIdX5okrCEBkxIMj7sjHhPiB6jma+pQw4zEAkaPUPj4s/4i+3qMfTZHRulIgAEwuhtK/GsTb5GrAHmPYzhjkiZD68zKmfhOqVBpO1oNEvKccp0a67kt4reytaSX/+5n1yqqHjMKiUE8V203hYiJQYXdP5e/dpSimMq+Fh9iDqRDCt5vdr6Q0709R1bvlyPPMoBlk/oppFIxl2bMjFsXxGOcw6nUMdzon7peYceoK3Xk1fjXyf2NrCicjDbwrn8uwU+00OVPhsn1LMaTbyuQaO+E1WVATEpNn5wkqQRMX/Ywqn1/4xJg5Q+gP64KtQVV2k7va20Li4j0A/OxlUoH/HWcarcQktljhQ4T4fZDbNQGVWIM5/A0gipDwO2bGiNobppcuWxJH/uoy8K/5R4xWT5r5KUjPEtHYM64iErsvmzPsABD8fNdf60Y/8L//UjViydeJ9fzzs+YM7gk0VJCZ/QLbMd0/5zFOAF440pmJiWyhqPiF6oUIROkJr+fPrqleK59fdAk2fjozRtZeJiPhw8FfxdiNdhXaTgXSl2LZbx06biYSSBhmMWGEtlkNSACeB+CJXGgFrbqKBQX/raguPpR7gOCPXwgk48+dm2pikKhP9Pg0yjAqD5Y/XM2VIMRrypG/bXS6HDGjpPYqGM/aVAk/Y+23p8HTOU6rE8CDOrKh9O7w7VYcaOxESmciDG5njF3bENiADzvZ7uPJ9fxrOxAsw/y1aiMukHz8QpiRFsTdxk1oNWskwvmawufBxef57qUPzCMEUhGW7A81MdXp1ON38KlveK6kbinq8CVsHnXRu9QMa0/lBvpiRamfku7BGPRgzPEwECNEyaAnQq6FdspB0HMuEH9aRXXRX93GrQ/YdmggfjaYeaVWpcl2Z+Q0OAVQLeMYmWpPBkziF22PhOwvTbco3/jpY9xvsSTp1+MRo7jE0tT01grsMIg+snZRYh3/vKJm6P7o5WwYXH2LUi6Vc9+Tpy3f4tdJPHKrjFTueM6ThbYFWYBnfO/Hr9uCALyJ3TgPy6h7Nj2HuJ8CzJGDtY7V+R89YKQV3FdAsKl2s7pz9pi6uFsaE3HqWCJAF3oDMnfjoU5YjsGcz4a49yeyaBdi3kQXJNluEWan05DxvL6ypO4dv23ica434fPHVhc+hiD3IojA6VB9uyDZ5gVRmC/g7yYD5k0q6lxaUVP4JDZBPjz95Fq62i0KpuXqeUFDcP8Qdm/c0aJCwgUs4u8DIbMz3VeqOOjy95tE9xkJVVqcGvnOWCNgHqztFIgFZvvZMO1W0oIxJBW4LEBqNRBUwsZaOyq8/S4F3miUx5oBGdL30YyOKAwMKVsPYt04vaQ27YASeyl78bhdDNfCGzjGHzCZg6i7fU7h5CAtwK2YFolEJ78wesVniW2Tz8c+X9wHPyFzAQznhZjwPppJYlynbZO37rARMP+SY4Uee/rklxt8GBXzhxwLbD6CaewCPX0fllD/4T9LPJbNG7ovgi7s9/fWFmgrsIR6CZZQWyGU7cpeGdhVhvO5+LQ/GYw2DdnfJ6CyL06Ey/MEbR97xPkr924gJBpDPsUniK0fs5RyhoDTXqKhjSHKsw9S9gM1plfML5xGNy25k+RriiGi7Ecs0Xysa4uJ6PErK8ezERwwJEPCvTsnFAosAzNcwYxkMgz/evroJeumj6idbETDR+OVo+sx+HW0O9oI036BY8Eoe1pBeX/EDi9HrigeYM4oWf5a7kZ5XHOTPCId8tkPvJ2LKGWUWM4buvzTkBnRy5r+OFocw/kTUF8jn0wA13er7ToPtqgTu2gtAbEHyLtXYiJlWj3AgGBi39pN6kiomq8r5hWei4XlmyG+A+gR0CiRWOQMiPIXSNleN3PkkhbWPlXn/r2xLxTugx8/mwQYF4G4uXEJQ7909SAhC+EhTJwxckk8p+O3TT4y1wOTDydBjAfb9HIYs8dsBBmH55jLXHDeZEis3liQDCPxWgd3wngHBN2XUmoytd3sXDtzZG1K17NszpADoP5WwEJogplgLHD/g4iSr06E65+3loDYExiQO+EdNJCCuuOAsbsVklyDVQjH/wujeTyWCP8GVzHKidFekFjwUnqZpnpu7PyiJ0a/dPzufkeZjtNPr90A8fyDLdxhUAWLSEjNwZgwiQEinIhXU5eWzS8aP3ny5LRjZh9cYZtesvSuiOEeg/HfjVubtUSAQbTBJhKRkkBSu7ZiftGtel9phsE5rlGO8Wjka24OO19HnPAzqZroPayW+SA0RlxagJMvzJzglFT1eS+tBPAhFjhuM3PkzUQsa0L8lGOrc6pG1Mb987Kaot8iHrsX0nCkC68mLg1wPSEdH+L6crqBhJdNobrZvFfeZSDAzZjI7rpvNCRBtDTY7iws5Uwk0bKBV7YAHKmsSWCjczHGQFy6wFh6ZQ7ZSzDPdf5+pESYRCj2pdZiHMfRl6c7DWN6f+XI2msT6/nnFdUFV8Gje9Dvg4wEnFyClEZKW8F2GQlQthiuVIOzDP76ERyA5kqlNhrSOH76qUvW+R2f/nxxt2DIvQlG6kroW8uPeLVkIB0M7/pPkBoGRFmXsjnFA6Tl3gOij4FBjhtpLJYw91Rv286VM0ctq84WIN8bwzLh7SDCkESjD+RCxblcqHloq+veWZOQ+7pgcXG3hq3Ox2izOyUcqqtRGc5RVacuj3t3fv9jaoYOhle8EPU6Uc0R+bAVr3yHF9+ZIPTrJR8zEoCVx84bWozfxlwAoDnk7hjgV5tV11HzSue18LGR8h0B8X4QhNIrbGxPsfU4Vz1tKufKdMk91m1V4JFVzC+4CEDuALf29KWBhhAlCkROUQ2bbk+3epYM74J/F+c07aYugetxI+DtoTkVc/K8Oehq230XuJtYVeLFApivRC7rn4FcazyJhvr3YLPYDclwaXfgpLwKQh1GNUdGBbV+sB1jSKo8WmL7NgnAymXVRbcEQvJWBCq6LQ0LvItHkPv+fSIwnuOtmL1yLGsKkHQObYdvALUrFnH+B869aNao5auT22W6jknDX8GtI2JekkYaInMirQauJ96kWfZ5JhiJz8rmFvaF2rwD9utsIj9RYjHeMHb+/aVRNdzFl/q4StdFbfmtdGXTgSPrFk+GT5AIC1KS09jgzoKd8fY7AR4IwXTLxQjqnkism+o8OwJUImeS93UNXoA7Uacl2Am9k6i4Hhtp700FuHxe4RVIct2JnXNdqb5YKD0gykZkIi8B8VqE5KlgJN6jbfhxn07XAWE3I9DK0ekDwqRKstUaOAUXwwAvTWzT1jk490w41HdBVe6ns6RaGiCxyBAhtVLrGs6lqdSND3fyZGGsHlQ4FS7nRYzqWagiwZz/htcDyaXiylyyIgBBnA3/3pGBheCcAXA1GW2CC6ULZE4AMh9J1Y3Wi8J8DBM6IlF9QLTBZe51M9Ls908Fy7935ryCE7C69DCQtn8cJt1LB5toHTWBHppfN5sjPbWAE7gDhL2EyKCqYdEG1FFfIcicAOl6Xt9M+sJ2+SkwzJMSjS7OVwaM8Cl+wi+pSavLrAnAlmXzCo6BallAH5cDpX4HIaJI8142Y8Syf7eCjhujZ5+APUfRR4CwsrjO9doBae4DbsMPN2Srw334ZfOO29swgo+CsCP9V1Kpd8FwLtaebz/4jdrbwJ0tVIXfNt0RHsxY+NB/gW3YO05YLypnaHjHZ5833LXqsm0patiG2zCnm7X6As1wTiZYD9N0woySzNF74hjaRQA2PHNuwWnQxc/hNJc6nkSAUcOqqbimcsTSvycC98+pPn7qlXcntpdfpz0aBkZopt26Zqeq2XEuiuV4/CZtHrkuLfN2/TO2q/+Ro9Bj4VDo1UTVU26D/ENVecsdFW0BHVM9tJ9pwo9HqryVrYm6zyMQveLw9+q++XBgwX1wN69m/olKRjsF+Lk0xxalVaVLV7bVT+LzdhOAjctris4C55PjQ3EiABIM2GRw3+3puE/bBUsygtTtCEvr8Kj7cqTZPvf5M1Z8y3vtKXw3AQsiD0MCutEDYWG0ipWnha4buaCqdGXKrGq6Poonw/cf6GATGX7lHXtcfQNNlQQJ/gTS8JVpmcV6dU8jH5zP990cp6Jy5LKF6eCmu79dBCCw8jmF52Mn2FScBkkEzdHkPtudlhs2JqTbpIUdAmeYhnwSBOwanxwNacTF8qBb3h5vxp8UN+jCNv0H6iPu/saM8/+5Ebui6rTWfrvfNt0RntJwcPbDcDYO8J0IOh7wnHREzXaUNqx9bLJttwKJuVfTwcp0f7sJQKBIlJVDBT0OA9Z5GzIRLUac16WrxiMCfCtV52fMGTIsEDSfQYZxrzjXgggw7u8gaDujalTt2lTtMt1jEhCrdk+BCMW+Do8Z0jW2ipTPKlnZZt4nGT5XtBwr9CwQP9yfn1+HARwkfiPy9xXTU7yC5ddr6wgSbn/hiw7gsDEwd99wsix0xxCMHYMNr4uxcjaJfnRyD7P5+pFrj4DkrNnWDqG+JY8E1807e17hfslt2rrmenU4LEdDkmZTBbHQ6AN5AywZqMaOjSFtwUh+bud15k5q/McOLflUS5fjfor4Y+QvQT77+0UEIACI9yvRaORUIHMVjSqLJ7KyCxA6Bb/E+hJe4CvSDxK+qkaseMd2ZClU1gdxIhBhljzEteTcMdtBhBewNzX3W2McclBTNUzgjUSgpCEemV22oHhowhAynuoclx2tBTOV+lJKOhD5kPAXYQNOTCfhGQEnPWxJ2qSH7bksq8QiS6cA0hDGeYx+tV0AACICSEZSWDyDDU738McyEuHS80AOZRYQf6R2U/02UfV+OCJLgdR1ifWzOWeA9MGgwnvR9zWaGdA5o1PojG/hppZlSg6W1RQehrTCJNiosTDslo98jI8ej4Nk5H1bzfzJC0oWhLMZS1t1dhgB/I7GVhddioXtO6GLd/V1sTbQ3D1mu5uw1vI4snVTkROq99voFSfTnEMV1IIItno72iRHzR6z5Au/bnuOgHu3GbT+CAbw3EVsNYTR/Nax7dOrSle0cBe55gtR+QNc2guw6tdJjwOE49gtekBRvNcr1JVYKuU7cTus7HACcGR8DRXK7X5shDoVLlo816ITc9pPd37A7SoY6qkQYxpHNRY5JOyTWAAJOtz3OnScEHWWR3KNkS8MS7/1PRM24CgwA3rTNiLogOlLhPBjm0XTW7lm3m+A5QsRxo0B03RlioMSzBILrphjfyoqjcmzS7aPETKNr0MIwA6ZS+/ZqM4FByHziJWz2KI5n3mE0AvbYQzgdRCjRln4+QNH5iC98STa9I+rMLqoYWdObr45NtXWEsJrq4AICNgkiIB1NxS6kzjfipEgRnD3g9E2WiCeUTXr6O0tzs3b49+3NSb/eYcRwO+AG7kcw52ArSyXYivJnnTnfOTSqEnoZuhbbSxBiI24FcD9XXEeL9rwNTv/Qu7oMjxLeBKvkvZksppsrF64rJcRji7Cy+HxPaNkAvarcz8xiNTzGvFI7uE/nvgb3s583H+nLG0Hv/BBhxPAH1/ZvOF74+cNLsKS5YWYaG+i0Q/l/TpECsSd/1oW3KYRhRQ9Cr580LCjPzU7nWKLHE3QVNJypBnCL+fynfbuMLT7GArLiMI9FNx+INIfAwCwGz6t5ksm0KoGfYIx3oPKfMxS7rPtWrdoOdp2XbUaULtab0dlLRGWOwK8dg4QXWAFjBC50A/tM4EkouCVcBGIm6H8vZsW4FBqGG/k4IOFRySZoUJof/gCk/bKYnodzzUZSFAtARGs2BlqCeo+lWPmLkjctqLrdvDXTidA4nzwBvxRWBwvxT0QRByJBBfeICExgDgiLFkSUJEcq7/8kft1iGwfePwkdgN1uekXKlDfgIeDfbDibTR5Hse52BCQcmezD64jj96IOrKHLGBz15zZ6ZvDsS15GDZYFYAIA4HNXvDj8RoEk8yeWooTBZhjScSzNxF8Q6+TSJ6O96QACMf/liTqod//D1H7a4bhLrS37LE63R7QLIa8w6r8KgiQPBvuxQnj/4zEfuuDsPv6EOjmQ4BQLozvhrq7AMFUO0A1PtxMzllgcQjPubhO9fQN7n2JBx9huzkW1dXbjdHGj7jEiGe/qvKrJEBKDCFCGrdgcGcnanUSbiAYtdwANIqFHWcGfu1LGGFhCyO0VQSamsTPvX76NXB3ynkk3fz/N0sMNFAnyaUAAAAASUVORK5CYII=';

const FONTE = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";

/**
 * Casca padrão de todo e-mail: cabeçalho com o nome do espaço, o
 * conteúdo passado em bodyHtml, e um rodapé só com o aviso de e-mail
 * automático — sem telefone, endereço ou site, porque esses dados ainda
 * não são os oficiais do espaço.
 */
export function renderEmailShell(params: {
  title: string;
  headerSubtitle?: string;
  bodyHtml: string;
  headerGradient?: string;
}): string {
  const { title, headerSubtitle, bodyHtml, headerGradient } = params;
  const anoAtual = new Date().getFullYear();

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin:0; padding:0; background-color:${CORES.areiaSereno}; font-family:${FONTE};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${CORES.areiaSereno}; padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:${CORES.brancoPerola}; border-radius:16px; overflow:hidden;">
              <tr>
                <td style="background:${headerGradient || CORES.azulAbissal}; padding:32px 32px 36px; text-align:center;">
                  <img src="data:image/png;base64,${LOGO_BASE64}" width="56" height="56" alt="Sede Campestre" style="display:block; margin:0 auto 12px; border:0;" />
                  <div style="color:${CORES.brancoPerola}; font-size:26px; font-weight:700; font-family:Georgia, serif;">Sede Campestre</div>
                  ${headerSubtitle ? `<div style="color:${CORES.areiaSereno}; margin-top:8px; font-size:17px;">${headerSubtitle}</div>` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding:32px;">
                  ${bodyHtml}
                </td>
              </tr>
              <tr>
                <td style="background:${CORES.azulAbissal}; padding:24px 32px; text-align:center;">
                  <div style="color:#B9C6CE; font-size:14px;">
                    © ${anoAtual} Sede Campestre. Este é um e-mail automático, por favor não responda.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/** Uma linha rótulo: valor, alinhada em tabela — com o dois-pontos incluso no rótulo. */
export function renderInfoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:12px 0; border-bottom:1px solid #E0DCD3; font-size:17px; color:${CORES.textoMuted}; font-weight:600; white-space:nowrap;">
        ${label}:
      </td>
      <td style="padding:12px 0 12px 16px; border-bottom:1px solid #E0DCD3; font-size:17px; color:${CORES.azulAbissal}; font-weight:700; text-align:right;">
        ${value}
      </td>
    </tr>
  `;
}

/** Cartão com título e uma tabela de linhas rótulo:valor (renderInfoRow) dentro. */
export function renderInfoCard(titulo: string, linhasHtml: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CORES.areiaSereno}; border:2px solid ${CORES.douradoPresenca}; border-radius:12px; margin:0 0 24px;">
      <tr>
        <td style="padding:24px;">
          <div style="font-size:19px; font-weight:700; color:${CORES.azulAbissal}; margin-bottom:16px;">${titulo}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${linhasHtml}
          </table>
        </td>
      </tr>
    </table>
  `;
}

/** Botão "à prova de bala" pra e-mail (tabela, não <a> flutuante). */
export function renderButton(params: {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary';
}): string {
  const { label, href, variant = 'primary' } = params;
  const isPrimary = variant === 'primary';
  const bg = isPrimary ? CORES.douradoPresenca : 'transparent';
  const color = isPrimary ? CORES.brancoPerola : CORES.azulAbissal;
  const border = isPrimary
    ? `border:2px solid ${CORES.douradoPresenca};`
    : `border:2px solid ${CORES.azulAbissal};`;

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px auto;">
      <tr>
        <td style="border-radius:8px; background:${bg}; ${border}">
          <a href="${href}" style="display:inline-block; padding:14px 28px; font-size:17px; font-weight:700; color:${color}; text-decoration:none;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
  `;
}

export function renderParagraph(html: string, opts?: { muted?: boolean }): string {
  const color = opts?.muted ? CORES.textoMuted : CORES.azulAbissal;
  return `<p style="margin:0 0 16px; font-size:17px; line-height:1.6; color:${color};">${html}</p>`;
}
